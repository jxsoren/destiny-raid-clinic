// Owns the three.js scene for ArenaScene: ground/obstacle/wall meshes from a real ArenaDef, plate
// and Oracle-marker meshes from the mechanics config, a scripted entity driven by scenario.ts
// through the real engine/mechanics pipeline, a fixed angled-overview camera, basic lighting and a
// fixed-timestep render loop. No real input yet — see
// docs/superpowers/specs/2026-10-23-atheon-entities-mechanics-feedback-design.md for why.
import type {
  ArenaDef,
  EncounterMechanicsConfig,
  MechanicsState,
  NavGrid,
  Point,
  SequenceCalloutConfig,
  SequenceCalloutState,
} from '@raid-clinic/sim';
import { buildNavGrid, distance } from '@raid-clinic/sim';
import {
  BoxGeometry,
  CapsuleGeometry,
  CircleGeometry,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  Vector3,
  WebGPURenderer,
} from 'three/webgpu';
import {
  type ArenaLevels,
  type EncounterLevelsContent,
  hallBandSegments,
  heightAt,
  type StairDef,
  toArenaLevels,
} from './levels';
import {
  ENTITY_COLOR,
  groundColor,
  levelColor,
  litMarkerIds,
  MARKER_LIT_COLOR,
  MARKER_UNLIT_COLOR,
  OBSTACLE_COLOR,
  PLATE_LIT_COLORS,
  PLATE_UNLIT_COLOR,
  plateColor,
  SCENE_BACKGROUND_COLOR,
  STAIR_COLOR,
  SUN_COLOR,
  WALL_COLOR,
} from './materials';
import {
  createScenarioState,
  type ScenarioState,
  stepScenario,
  TICK_SECONDS,
  WIN_WINDOW_START_TICK,
} from './scenario';
import {
  createSessionState,
  PLAYER_ENTITY_ID,
  type PlayerRole,
  type SessionState,
  stepSession,
} from './session';

export interface Marker {
  id: string;
  label: string;
  position: Point;
}

/** Wall fences' real height, tuned visually against the dev server — taller than the entity
 * (ENTITY_HEIGHT, below) so walls always read as a real barrier rather than a curb. */
const WALL_HEIGHT = 6;
/** Stair ramp mesh thickness, in sim units (perpendicular to its sloped top face). */
const STAIR_THICKNESS = 1;
/** Wall fence thickness, in sim units. */
const WALL_THICKNESS = 2;
/** Obstacle patches sit this far above the ground, to avoid z-fighting. */
const OBSTACLE_LIFT = 0.02;
/** Plate discs sit this far above the ground, above the obstacle layer. */
const PLATE_LIFT = 0.03;
/** Oracle marker sphere radius and resting height. */
const MARKER_RADIUS = 6;
const MARKER_HEIGHT = 8;
/** Entity capsule dimensions: cylindrical mid-section length and end-cap radius. */
const ENTITY_LENGTH = 6;
const ENTITY_RADIUS = 2;
const ENTITY_HEIGHT = ENTITY_RADIUS + ENTITY_LENGTH / 2;

/** The single callout mechanic the scripted scenario lights markers up for. */
const ORACLE_CALLOUT_ID = 'oracle-order';

/** Caps how many scenario ticks `frame()` will catch up on in a single real frame. */
const MAX_TICKS_PER_FRAME = 10;

/** Vertical field of view for the fixed establishing-shot camera. */
const FOV_DEGREES = 50;
/** The camera's down-angle from horizontal. */
const CAMERA_ANGLE_DEGREES = 55;
/** Extra headroom so the arena isn't framed exactly edge-to-edge. */
const FRAME_MARGIN = 1.2;

/** WASD/arrow key codes mapped to their direction contribution. Multiple held keys sum (e.g. 'w'+'d'
 * gives a diagonal) — the engine's `advanceDirect` normalizes the result, so no pre-normalization is
 * needed here. */
const KEY_DIRECTIONS: Record<string, { dx: number; dy: number }> = {
  w: { dx: 0, dy: -1 },
  arrowup: { dx: 0, dy: -1 },
  s: { dx: 0, dy: 1 },
  arrowdown: { dx: 0, dy: 1 },
  a: { dx: -1, dy: 0 },
  arrowleft: { dx: -1, dy: 0 },
  d: { dx: 1, dy: 0 },
  arrowright: { dx: 1, dy: 0 },
};
/** How far behind the player (along their facing direction) the follow camera sits, in sim units. */
const FOLLOW_CAMERA_BACK_DISTANCE = 40;
/** How far above the player's local ground the follow camera sits. */
const FOLLOW_CAMERA_HEIGHT = 30;
/** How far above the player's local ground the follow camera looks at (roughly chest height). */
const FOLLOW_CAMERA_LOOK_HEIGHT = 6;
/** Per-frame interpolation factor toward the follow camera's target position/look-at — tuned
 * visually against the dev server, not mathematically derived (a feel parameter, like WALL_HEIGHT). */
const FOLLOW_CAMERA_LERP = 0.1;

/**
 * Derives the camera's height and backward setback (both along the `arena.height` axis) so that,
 * looking down at `CAMERA_ANGLE_DEGREES` with `FOV_DEGREES` vertical FOV, the visible strip of
 * ground plane between the near and far edges of the view frustum spans `arenaHeight * FRAME_MARGIN`.
 *
 * For a camera at height `h` looking down at angle `a` from horizontal, a ground point at
 * depression angle `a` from the camera's base is at horizontal distance `h / tan(a)` — so the near
 * edge of the vertical FOV (steeper angle `a + halfFov`, closer) and far edge (shallower angle
 * `a - halfFov`, farther) bound a visible ground strip of length
 * `h * (1/tan(a - halfFov) - 1/tan(a + halfFov))`. Solving for `h` given a target span gives the
 * formula below; the setback (how far back from the target point the camera sits) is then
 * `h / tan(a)`, the horizontal distance to the point directly below the look-at target.
 *
 * Only solves for the height axis — fine for Atheon (720x1000, taller than wide, so the vertical
 * framing is always the binding constraint at realistic widescreen aspect ratios), but a future
 * arena wider than it is deep could clip horizontally. Revisit if that comes up.
 */
export function overviewOffset(arenaHeight: number): { elevation: number; setback: number } {
  const angle = (CAMERA_ANGLE_DEGREES * Math.PI) / 180;
  const halfFov = (FOV_DEGREES * Math.PI) / 360;
  const spanPerUnitHeight = 1 / Math.tan(angle - halfFov) - 1 / Math.tan(angle + halfFov);
  const elevation = (arenaHeight * FRAME_MARGIN) / spanPerUnitHeight;
  const setback = elevation / Math.tan(angle);
  return { elevation, setback };
}

// `ShapeGeometry`'s local Y maps onto world Z through `rotateX(-PI/2)` below (chosen for that
// rotation direction to leave the flattened face's normal pointing up, +Y, so it's visible from
// the overview camera) — but that rotation negates Y onto Z (local Y becomes world -Z). Building
// the shape with Y negated up front cancels that out, so the net effect matches every other mesh
// builder in this file: sim x -> world x, sim y -> world z, with no sign flip.
export function shapeFromPolygon(points: Point[]): Shape {
  const shape = new Shape();
  shape.moveTo(points[0].x, -points[0].y);
  for (const point of points.slice(1)) shape.lineTo(point.x, -point.y);
  shape.closePath();
  return shape;
}

/** Lays a shape-geometry mesh flat on the ground (XZ plane: sim x -> world x, sim y -> world z). */
function flatMesh(points: Point[], material: MeshStandardMaterial, height: number): Mesh {
  const geometry = new ShapeGeometry(shapeFromPolygon(points));
  geometry.rotateX(-Math.PI / 2);
  const mesh = new Mesh(geometry, material);
  mesh.position.y = height;
  return mesh;
}

function wallMesh(a: Point, b: Point, material: MeshStandardMaterial, baseHeight: number): Mesh {
  const length = distance(a, b);
  const geometry = new BoxGeometry(length, WALL_HEIGHT, WALL_THICKNESS);
  const mesh = new Mesh(geometry, material);
  mesh.position.set((a.x + b.x) / 2, baseHeight + WALL_HEIGHT / 2, (a.y + b.y) / 2);
  mesh.rotation.y = -Math.atan2(b.y - a.y, b.x - a.x);
  return mesh;
}

/** A simple average-of-vertices centroid — an approximation (not the exact area centroid), good
 * enough for picking a representative point to look up an obstacle's local ground height. */
function polygonCentroid(points: Point[]): Point {
  let x = 0;
  let y = 0;
  for (const point of points) {
    x += point.x;
    y += point.y;
  }
  return { x: x / points.length, y: y / points.length };
}

/** A sloped box bridging a stairs ramp's two endpoints at their respective heights. Orients via a
 * single quaternion rotation (mapping local +X to the real 3D direction from `a` to `b`, height
 * difference included) rather than composing Euler angles, so the box's declared length always
 * matches its true 3D span exactly, with no yaw/pitch-order ambiguity. */
function stairMesh(stair: StairDef, material: MeshStandardMaterial): Mesh {
  const direction = new Vector3(stair.b.x - stair.a.x, stair.h1 - stair.h0, stair.b.y - stair.a.y);
  const slopeLength = direction.length();
  const geometry = new BoxGeometry(slopeLength, STAIR_THICKNESS, stair.w);
  const mesh = new Mesh(geometry, material);
  mesh.position.set(
    (stair.a.x + stair.b.x) / 2,
    (stair.h0 + stair.h1) / 2,
    (stair.a.y + stair.b.y) / 2,
  );
  mesh.quaternion.setFromUnitVectors(new Vector3(1, 0, 0), direction.clone().normalize());
  return mesh;
}

export class ArenaRenderer {
  /** Resolves once the GPU is ready; rejects when neither WebGPU nor WebGL2 is available. */
  static async create(
    canvas: HTMLCanvasElement,
    arena: ArenaDef,
    config: EncounterMechanicsConfig,
    markers: Marker[],
    levelsContent: EncounterLevelsContent,
  ): Promise<ArenaRenderer> {
    const renderer = new WebGPURenderer({ canvas, antialias: true });
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
    return new ArenaRenderer(renderer, arena, config, markers, toArenaLevels(levelsContent));
  }

  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  /** One material per ground mesh (each `arena.levels` entry plus each `hallBandSegments` band),
   * alongside its own base (non-wipe/win) color so `applyScenario` can restore it when neither
   * override applies. */
  private readonly groundMaterials: Array<{ material: MeshStandardMaterial; baseColor: number }> =
    [];
  private readonly plateMaterials = new Map<string, MeshStandardMaterial>();
  private readonly markerMaterials = new Map<string, MeshStandardMaterial>();
  /** One capsule mesh per scripted entity, keyed by `Entity.id` — `scenario.ts` may script more
   * than one (e.g. Atheon's Mars + Venus plate bots). */
  private readonly entityMeshes = new Map<string, Mesh>();
  private readonly grid: NavGrid;
  private scenario: ScenarioState;
  private accumulator = 0;
  private lastTime: number | null = null;
  /** Non-null once `startLiveSession` has been called — switches the render loop from the idle demo
   * to the interactive one. */
  private session: SessionState | null = null;
  private readonly heldKeys = new Set<string>();
  /** The player's last nonzero movement direction, in radians — persists through idle moments
   * (matching the prototype's own behavior), used to orient the follow camera. Defaults to facing
   * toward the player's plate target, computed once `startLiveSession` is called. */
  private facing = 0;
  private readonly cameraLookAt = new Vector3();
  private keydownListener: ((event: KeyboardEvent) => void) | null = null;
  private keyupListener: ((event: KeyboardEvent) => void) | null = null;
  private rally!: Point;

  private constructor(
    private readonly renderer: WebGPURenderer,
    arena: ArenaDef,
    private readonly config: EncounterMechanicsConfig,
    markers: Marker[],
    private readonly levels: ArenaLevels,
  ) {
    this.grid = buildNavGrid(arena, 5);
    const rally = markers.find((m) => m.id === 'rally');
    if (!rally) throw new Error("Scene requires a 'rally' marker");
    this.rally = rally.position;
    this.scenario = createScenarioState(config, rally.position);

    this.scene.background = new Color(SCENE_BACKGROUND_COLOR);

    const addGround = (polygon: Point[], height: number): void => {
      const color = levelColor(height);
      const material = new MeshStandardMaterial({ color, roughness: 0.9 });
      this.scene.add(flatMesh(polygon, material, height));
      this.groundMaterials.push({ material, baseColor: color });
    };
    for (const level of this.levels.levels) addGround(level.polygon, level.height);
    // arena.walkable[0] is the "upper" hallway region by content-authoring convention (see
    // encounter.json's arena.walkable ordering / the Arena Geometry sub-project's design doc) — the
    // only one of the three walkable polygons that needs hallBands' depth-based terracing.
    for (const band of hallBandSegments(arena.walkable[0], this.levels.hallBands)) {
      addGround(band.polygon, band.height);
    }

    const stairMaterial = new MeshStandardMaterial({ color: STAIR_COLOR, roughness: 0.8 });
    for (const stair of this.levels.stairs) this.scene.add(stairMesh(stair, stairMaterial));

    const obstacleMaterial = new MeshStandardMaterial({ color: OBSTACLE_COLOR, roughness: 0.9 });
    for (const polygon of arena.obstacles) {
      const base = heightAt(
        polygonCentroid(polygon),
        this.levels.levels,
        this.levels.stairs,
        this.levels.hallBands,
      );
      this.scene.add(flatMesh(polygon, obstacleMaterial, base + OBSTACLE_LIFT));
    }

    const wallMaterial = new MeshStandardMaterial({ color: WALL_COLOR });
    for (const [a, b] of arena.walls) {
      const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const base = heightAt(
        midpoint,
        this.levels.levels,
        this.levels.stairs,
        this.levels.hallBands,
      );
      this.scene.add(wallMesh(a, b, wallMaterial, base));
    }

    const heightHere = (point: Point): number =>
      heightAt(point, this.levels.levels, this.levels.stairs, this.levels.hallBands);

    for (const plateConfig of config.plates) {
      const material = new MeshStandardMaterial({ color: PLATE_UNLIT_COLOR });
      const geometry = new CircleGeometry(plateConfig.radius, 32);
      geometry.rotateX(-Math.PI / 2);
      const mesh = new Mesh(geometry, material);
      const base = heightHere(plateConfig.position);
      mesh.position.set(plateConfig.position.x, base + PLATE_LIFT, plateConfig.position.y);
      this.scene.add(mesh);
      this.plateMaterials.set(plateConfig.id, material);
    }

    for (const marker of markers.filter((m) => m.id.startsWith('oracle-'))) {
      const material = new MeshStandardMaterial({ color: MARKER_UNLIT_COLOR });
      const mesh = new Mesh(new SphereGeometry(MARKER_RADIUS, 16, 16), material);
      const base = heightHere(marker.position);
      mesh.position.set(marker.position.x, base + MARKER_HEIGHT, marker.position.y);
      this.scene.add(mesh);
      this.markerMaterials.set(marker.id, material);
    }

    for (const entity of this.scenario.world.entities) this.createEntityMesh(entity.id);

    this.scene.add(new HemisphereLight(0xffffff, 0x444444, 1));
    const sun = new DirectionalLight(SUN_COLOR, 1.1);
    sun.position.set(arena.width * 0.3, arena.height * 0.9, -arena.height * 0.2);
    this.scene.add(sun);

    // A fixed, angled-overview establishing shot framing the whole arena. Never moves — interactive
    // camera controls are a later sub-project.
    this.camera = new PerspectiveCamera(FOV_DEGREES, 1, 1, 5000);
    const centerX = arena.width / 2;
    const centerZ = arena.height / 2;
    const { elevation, setback } = overviewOffset(arena.height);
    this.camera.position.set(centerX, elevation, centerZ - setback);
    this.cameraLookAt.set(centerX, 0, centerZ);
    this.camera.lookAt(this.cameraLookAt);

    this.applyScenario();
  }

  resize(width: number, height: number, dpr: number): void {
    if (width <= 0 || height <= 0) return;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  start(): void {
    this.lastTime = null;
    this.accumulator = 0;
    void this.renderer.setAnimationLoop(this.frame);
  }

  stop(): void {
    void this.renderer.setAnimationLoop(null);
    if (this.keydownListener) globalThis.removeEventListener('keydown', this.keydownListener);
    if (this.keyupListener) globalThis.removeEventListener('keyup', this.keyupListener);
  }

  dispose(): void {
    this.stop();
    this.renderer.dispose();
  }

  /** Begins an interactive playthrough as `role` — switches the render loop from the idle demo to
   * live input/camera-follow. Currently only `'plate'` is meaningful to pass (the role picker only
   * offers it); `'caller'` is accepted for forward-compatibility with a later sub-project. */
  startLiveSession(role: PlayerRole): void {
    if (this.session) return;
    this.session = createSessionState(this.config, this.rally, role);
    const plateConfig = this.config.plates.find((plate) => plate.id === 'mars-plate');
    this.facing = plateConfig
      ? Math.atan2(plateConfig.position.y - this.rally.y, plateConfig.position.x - this.rally.x)
      : 0;
    this.keydownListener = (event) => this.heldKeys.add(event.key.toLowerCase());
    this.keyupListener = (event) => this.heldKeys.delete(event.key.toLowerCase());
    globalThis.addEventListener('keydown', this.keydownListener);
    globalThis.addEventListener('keyup', this.keyupListener);
  }

  private createEntityMesh(id: string): void {
    const entityMaterial = new MeshStandardMaterial({ color: ENTITY_COLOR });
    const mesh = new Mesh(new CapsuleGeometry(ENTITY_RADIUS, ENTITY_LENGTH, 4, 8), entityMaterial);
    this.scene.add(mesh);
    this.entityMeshes.set(id, mesh);
  }

  private playerInput(): { dx: number; dy: number } {
    let dx = 0;
    let dy = 0;
    for (const key of this.heldKeys) {
      const direction = KEY_DIRECTIONS[key];
      if (direction) {
        dx += direction.dx;
        dy += direction.dy;
      }
    }
    return { dx, dy };
  }

  private updateFollowCamera(session: SessionState): void {
    const player = session.world.entities.find((entity) => entity.id === PLAYER_ENTITY_ID);
    if (!player) return;
    const base = heightAt(player.position, this.levels.levels, this.levels.stairs, this.levels.hallBands);
    const targetPosition = new Vector3(
      player.position.x - Math.cos(this.facing) * FOLLOW_CAMERA_BACK_DISTANCE,
      base + FOLLOW_CAMERA_HEIGHT,
      player.position.y - Math.sin(this.facing) * FOLLOW_CAMERA_BACK_DISTANCE,
    );
    const targetLookAt = new Vector3(
      player.position.x,
      base + FOLLOW_CAMERA_LOOK_HEIGHT,
      player.position.y,
    );
    this.camera.position.lerp(targetPosition, FOLLOW_CAMERA_LERP);
    this.cameraLookAt.lerp(targetLookAt, FOLLOW_CAMERA_LERP);
    this.camera.lookAt(this.cameraLookAt);
  }

  private readonly frame = (now: number): void => {
    const dt = this.lastTime === null ? 0 : Math.min(0.25, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.accumulator += dt;
    // The `Math.min(0.25, dt)` clamp above is the main defense against a huge catch-up burst (e.g.
    // after the tab was backgrounded), but MAX_TICKS_PER_FRAME is an explicit second guard so a
    // future change to that clamp or to TICK_HZ can't silently reintroduce an unbounded loop here.
    let ticksThisFrame = 0;
    if (this.session) {
      const input = this.playerInput();
      if (input.dx !== 0 || input.dy !== 0) this.facing = Math.atan2(input.dy, input.dx);
      while (this.accumulator >= TICK_SECONDS && ticksThisFrame < MAX_TICKS_PER_FRAME) {
        this.session = stepSession(this.grid, this.config, this.session, input);
        this.accumulator -= TICK_SECONDS;
        ticksThisFrame++;
      }
      this.applySession(this.session);
      this.updateFollowCamera(this.session);
    } else {
      while (this.accumulator >= TICK_SECONDS && ticksThisFrame < MAX_TICKS_PER_FRAME) {
        this.scenario = stepScenario(this.grid, this.config, this.scenario);
        this.accumulator -= TICK_SECONDS;
        ticksThisFrame++;
      }
      this.applyScenario();
    }
    this.renderer.render(this.scene, this.camera);
  };

  private applyScenario(): void {
    this.applyWorldState(this.scenario);
  }

  private applySession(session: SessionState): void {
    this.applyWorldState(session);
  }

  /** Updates every mesh from a world/mechanics snapshot — works for both `ScenarioState` (the idle
   * demo) and `SessionState` (a live playthrough). The parameter is the explicit union (not a
   * generic `{ world, mechanics }` shape) specifically so the `'tick' in state` check below
   * type-checks: TypeScript only narrows an `in` check across a union's members, not against a
   * single structural type that never declares the property at all. Only `inWinWindow` differs: the
   * idle demo derives it from a fixed script tick (`ScenarioState.tick`); a live session has no such
   * window yet (outcome overlays are a later sub-project), so it's always `false` there. */
  private applyWorldState(state: ScenarioState | SessionState): void {
    for (const entity of state.world.entities) {
      if (!this.entityMeshes.has(entity.id)) this.createEntityMesh(entity.id);
      const mesh = this.entityMeshes.get(entity.id);
      const base = heightAt(
        entity.position,
        this.levels.levels,
        this.levels.stairs,
        this.levels.hallBands,
      );
      mesh?.position.set(entity.position.x, base + ENTITY_HEIGHT, entity.position.y);
    }

    for (const plateConfig of this.config.plates) {
      const material = this.plateMaterials.get(plateConfig.id);
      if (!material) continue;
      const held = state.mechanics.plates[plateConfig.id]?.held ?? false;
      material.color.setHex(plateColor(plateConfig.id, held));
    }

    const calloutConfig = this.config.callouts.find((c) => c.id === ORACLE_CALLOUT_ID);
    const calloutState = state.mechanics.callouts[ORACLE_CALLOUT_ID];
    const litIds = litMarkerIds(calloutConfig, calloutState);
    for (const [id, material] of this.markerMaterials) {
      material.color.setHex(litIds.has(id) ? MARKER_LIT_COLOR : MARKER_UNLIT_COLOR);
    }

    const inWinWindow = 'tick' in state ? state.tick >= WIN_WINDOW_START_TICK : false;
    const override = groundColor(state.mechanics, inWinWindow);
    for (const { material, baseColor } of this.groundMaterials) {
      material.color.setHex(override ?? baseColor);
    }
  }
}
