// Owns the three.js scene for SpaceScene: background, stars, construction lines and planets, an
// orthographic camera framed by a View, parallax layers, the render loop and per-frame planet
// screen positions for the DOM overlay.
import { Group, OrthographicCamera, Scene, Vector2, WebGPURenderer } from 'three/webgpu';
import {
  HOME_VIEW,
  offsetScreen,
  planetScreen,
  screensDiffer,
  tweenView,
  worldPosition,
  worldRadius,
} from './layout';
import type { Quality } from './quality';
import { hashSeed } from './rng';
import { type Background, createBackground } from './shaders/background';
import { type Construction, createConstruction } from './shaders/construction';
import { createPlanet, type PlanetVisual, SPIN } from './shaders/planet';
import { createStars, type StarLayer } from './shaders/stars';
import { generateStars } from './stars';
import type { PlanetScreen, ScenePlanet, View } from './types';

export interface SpaceOptions {
  seed: number;
  quality: Quality;
  reducedMotion: boolean;
  forceWebGL?: boolean;
}

/** Parallax travel of the nearest layer at the screen edge, in CSS pixels (spec §3.4: about 8px). */
const PARALLAX_PX = 8;
/** Default camera move duration (spec §3.4: about 600ms). */
const VIEW_MS = 600;

interface Entry {
  data: ScenePlanet;
  visual: PlanetVisual;
  key: string;
}

export class SpaceRenderer {
  /** Resolves once the GPU is ready; rejects when neither WebGPU nor WebGL2 is available. */
  static async create(canvas: HTMLCanvasElement, options: SpaceOptions): Promise<SpaceRenderer> {
    const renderer = new WebGPURenderer({
      canvas,
      antialias: true,
      forceWebGL: options.forceWebGL ?? false,
    });
    try {
      await renderer.init();
    } catch (error) {
      renderer.dispose();
      throw error;
    }
    const backend = renderer.backend as {
      isWebGPUBackend?: boolean;
      device?: unknown;
      gl?: unknown;
    };
    if (!(backend.isWebGPUBackend ? backend.device : backend.gl)) {
      renderer.dispose();
      throw new Error('No WebGPU device or WebGL2 context');
    }
    return new SpaceRenderer(renderer, options);
  }

  readonly backend: 'webgpu' | 'webgl';
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  private readonly layers = { back: new Group(), stars: new Group(), planets: new Group() };
  private readonly background: Background;
  private readonly stars: StarLayer;
  private readonly brightStars: StarLayer;
  private readonly construction: Construction;
  private readonly planets = new Map<string, Entry>();
  private readonly listeners = new Set<(screens: PlanetScreen[]) => void>();
  private lastScreens: PlanetScreen[] = [];
  private width = 1;
  private height = 1;
  private view: View = HOME_VIEW;
  private tween: { from: View; to: View; start: number; duration: number } | null = null;
  private readonly pointer = new Vector2();
  private readonly smoothed = new Vector2();
  private motion: boolean;
  private elapsed = 0;
  private last = 0;
  private frames = 0;

  private constructor(
    private readonly renderer: WebGPURenderer,
    private readonly options: SpaceOptions,
  ) {
    this.backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend
      ? 'webgpu'
      : 'webgl';
    this.motion = !options.reducedMotion;
    this.camera.position.set(0, 0, 10);
    this.background = createBackground(options.seed, options.quality.octaves);
    this.stars = createStars(generateStars(options.seed, options.quality.stars, [0.8, 3]), false);
    this.brightStars = createStars(
      generateStars(options.seed + 1, options.quality.brightStars, [9, 15]),
      true,
    );
    this.construction = createConstruction();
    this.layers.back.add(this.construction.group);
    this.layers.stars.add(this.stars.sprite, this.brightStars.sprite);
    this.scene.add(this.background.mesh, this.layers.back, this.layers.stars, this.layers.planets);
  }

  /** Add, update and remove planets to match `list` (keyed by id). */
  setPlanets(list: ScenePlanet[]): void {
    const keep = new Set(list.map((p) => p.id));
    for (const [id, entry] of this.planets) {
      if (!keep.has(id)) {
        this.layers.planets.remove(entry.visual.group);
        entry.visual.dispose();
        this.planets.delete(id);
      }
    }
    for (const data of list) {
      const p = data.planet;
      const key = JSON.stringify([
        p.surface,
        p.tint,
        p.atmosphere,
        p.ring,
        p.size,
        Boolean(data.featured),
      ]);
      const prev = this.planets.get(data.id);
      if (prev && prev.key === key) {
        prev.data = data;
        prev.visual.setDim(Boolean(data.dimmed));
        continue;
      }
      if (prev) {
        this.layers.planets.remove(prev.visual.group);
        prev.visual.dispose();
      }
      const visual = createPlanet(data.planet, {
        featured: Boolean(data.featured),
        octaves: this.options.quality.octaves,
        seed: hashSeed(data.id),
      });
      visual.setDim(Boolean(data.dimmed));
      this.layers.planets.add(visual.group);
      this.planets.set(data.id, { data, visual, key });
    }
    this.placePlanets();
    this.lastScreens = [];
  }

  resize(width: number, height: number, dpr: number): void {
    if (width <= 0 || height <= 0) return;
    this.width = width;
    this.height = height;
    this.renderer.setPixelRatio(Math.min(dpr, this.options.quality.maxDpr));
    this.renderer.setSize(width, height, false);
    const aspect = width / height;
    this.background.setAspect(aspect);
    this.stars.setAspect(aspect);
    this.brightStars.setAspect(aspect);
    this.construction.setAspect(aspect);
    this.placePlanets();
    this.applyView();
    this.lastScreens = [];
  }

  /** Pointer position in [-1, 1] on each axis (y down). Ignored without parallax. */
  setPointer(x: number, y: number): void {
    if (!this.options.quality.parallax || !this.motion) return;
    this.pointer.set(x, y);
  }

  setMotion(on: boolean): void {
    this.motion = on;
    if (!on) this.pointer.set(0, 0);
  }

  /** Move the camera; animates unless reduced motion or durationMs is 0. */
  setView(view: View, durationMs = VIEW_MS): void {
    const target = this.tween?.to ?? this.view;
    if (target.cx === view.cx && target.cy === view.cy && target.zoom === view.zoom) return;
    if (!this.motion || durationMs <= 0) {
      this.tween = null;
      this.view = view;
      this.applyView();
      return;
    }
    this.tween = { from: this.view, to: view, start: performance.now(), duration: durationMs };
  }

  /** Called with planet screen positions whenever they change. Returns an unsubscribe function. */
  onFrame(listener: (screens: PlanetScreen[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start(): void {
    this.last = 0;
    void this.renderer.setAnimationLoop(this.frame);
  }

  stop(): void {
    void this.renderer.setAnimationLoop(null);
  }

  dispose(): void {
    this.stop();
    for (const entry of this.planets.values()) entry.visual.dispose();
    this.planets.clear();
    this.background.dispose();
    this.stars.dispose();
    this.brightStars.dispose();
    this.construction.dispose();
    this.listeners.clear();
    this.renderer.dispose();
  }

  private placePlanets(): void {
    const aspect = this.width / this.height;
    for (const { data, visual } of this.planets.values()) {
      const [x, y] = worldPosition(data.planet.position, aspect);
      visual.group.position.set(x, y, 0);
      visual.group.scale.setScalar(worldRadius(data.planet, data.featured));
    }
  }

  private applyView(): void {
    const halfH = 1 / this.view.zoom;
    const halfW = this.width / this.height / this.view.zoom;
    const { cx, cy } = this.view;
    this.camera.left = cx - halfW;
    this.camera.right = cx + halfW;
    this.camera.top = cy + halfH;
    this.camera.bottom = cy - halfH;
    this.camera.updateProjectionMatrix();
    this.background.setFrame(cx, cy, halfW * 1.02, halfH * 1.02);
  }

  private readonly frame = (now: number): void => {
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0;
    this.last = now;
    if (this.motion) this.elapsed += dt;

    if (this.tween) {
      const t = (now - this.tween.start) / this.tween.duration;
      this.view = tweenView(this.tween.from, this.tween.to, t);
      if (t >= 1) this.tween = null;
      this.applyView();
    }

    // Parallax: the nearer the layer, the further it moves against the pointer.
    this.smoothed.lerp(this.pointer, 1 - Math.exp(-dt * 6));
    const sx = -this.smoothed.x * PARALLAX_PX;
    const sy = -this.smoothed.y * PARALLAX_PX;
    const worldPerPx = 2 / this.view.zoom / this.height;
    this.layers.planets.position.set(sx * worldPerPx, -sy * worldPerPx, 0);
    this.layers.stars.position.set(sx * 0.4 * worldPerPx, -sy * 0.4 * worldPerPx, 0);
    this.layers.back.position.set(sx * 0.15 * worldPerPx, -sy * 0.15 * worldPerPx, 0);
    // The shader adds the offset after scaling x by aspect, so x is in height units like y.
    this.background.setOffset((-sx * 0.1) / this.height, (sy * 0.1) / this.height);

    const spin = this.motion ? dt * SPIN : 0;
    for (const { visual } of this.planets.values()) visual.update(this.elapsed, spin);
    this.background.setTime(this.elapsed);
    this.stars.setTime(this.elapsed);
    this.brightStars.setTime(this.elapsed);

    this.renderer.render(this.scene, this.camera);
    this.frames += 1;
    // Exposed for browser tests: the first frame (shaders compiled), then every 30th.
    if (this.frames === 1 || this.frames % 30 === 0)
      this.renderer.domElement.dataset.frames = String(this.frames);

    this.emitScreens(sx, sy);
  };

  private emitScreens(dx: number, dy: number): void {
    const screens = [...this.planets.values()].map(({ data }) =>
      offsetScreen(planetScreen(data, this.view, this.width, this.height), dx, dy),
    );
    if (!screensDiffer(screens, this.lastScreens, 0.25)) return;
    this.lastScreens = screens;
    for (const listener of this.listeners) listener(screens);
  }
}
