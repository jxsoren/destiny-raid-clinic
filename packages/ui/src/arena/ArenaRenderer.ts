// Owns the three.js scene for ArenaScene: ground/obstacle/wall meshes built from a real ArenaDef, a
// fixed angled-overview camera, basic lighting and the render loop. No entities, no interactivity —
// see docs/superpowers/specs/2026-10-23-atheon-scene-shell-design.md for why.
import type { ArenaDef, Point } from '@raid-clinic/sim';
import { distance } from '@raid-clinic/sim';
import {
  BoxGeometry,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Shape,
  ShapeGeometry,
  WebGPURenderer,
} from 'three/webgpu';

/** Wall fences get this height since no real wall-height data exists yet (a placeholder). */
const WALL_HEIGHT = 1;
/** Wall fence thickness, in sim units. */
const WALL_THICKNESS = 2;
/** Obstacle patches sit this far above the ground, to avoid z-fighting. */
const OBSTACLE_LIFT = 0.02;

/** Vertical field of view for the fixed establishing-shot camera. */
const FOV_DEGREES = 50;
/** The camera's down-angle from horizontal. */
const CAMERA_ANGLE_DEGREES = 55;
/** Extra headroom so the arena isn't framed exactly edge-to-edge. */
const FRAME_MARGIN = 1.2;

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

function shapeFromPolygon(points: Point[]): Shape {
  const shape = new Shape();
  shape.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) shape.lineTo(point.x, point.y);
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

function wallMesh(a: Point, b: Point, material: MeshStandardMaterial): Mesh {
  const length = distance(a, b);
  const geometry = new BoxGeometry(length, WALL_HEIGHT, WALL_THICKNESS);
  const mesh = new Mesh(geometry, material);
  mesh.position.set((a.x + b.x) / 2, WALL_HEIGHT / 2, (a.y + b.y) / 2);
  mesh.rotation.y = -Math.atan2(b.y - a.y, b.x - a.x);
  return mesh;
}

export class ArenaRenderer {
  /** Resolves once the GPU is ready; rejects when neither WebGPU nor WebGL2 is available. */
  static async create(canvas: HTMLCanvasElement, arena: ArenaDef): Promise<ArenaRenderer> {
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
    return new ArenaRenderer(renderer, arena);
  }

  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;

  private constructor(
    private readonly renderer: WebGPURenderer,
    arena: ArenaDef,
  ) {
    this.scene.background = new Color(0x1a1a1a);

    const groundMaterial = new MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.9 });
    for (const polygon of arena.walkable) this.scene.add(flatMesh(polygon, groundMaterial, 0));

    const obstacleMaterial = new MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
    for (const polygon of arena.obstacles) {
      this.scene.add(flatMesh(polygon, obstacleMaterial, OBSTACLE_LIFT));
    }

    const wallMaterial = new MeshStandardMaterial({ color: 0x555555 });
    for (const [a, b] of arena.walls) this.scene.add(wallMesh(a, b, wallMaterial));

    this.scene.add(new HemisphereLight(0xffffff, 0x444444, 1));
    const sun = new DirectionalLight(0xffffff, 1);
    sun.position.set(arena.width * 0.3, arena.height * 0.9, -arena.height * 0.2);
    this.scene.add(sun);

    // A fixed, angled-overview establishing shot framing the whole arena. Never moves — interactive
    // camera controls are a later sub-project.
    this.camera = new PerspectiveCamera(FOV_DEGREES, 1, 1, 5000);
    const centerX = arena.width / 2;
    const centerZ = arena.height / 2;
    const { elevation, setback } = overviewOffset(arena.height);
    this.camera.position.set(centerX, elevation, centerZ - setback);
    this.camera.lookAt(centerX, 0, centerZ);
  }

  resize(width: number, height: number, dpr: number): void {
    if (width <= 0 || height <= 0) return;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  start(): void {
    void this.renderer.setAnimationLoop(this.frame);
  }

  stop(): void {
    void this.renderer.setAnimationLoop(null);
  }

  dispose(): void {
    this.stop();
    this.renderer.dispose();
  }

  private readonly frame = (): void => {
    this.renderer.render(this.scene, this.camera);
  };
}
