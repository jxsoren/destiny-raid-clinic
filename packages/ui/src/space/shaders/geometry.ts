import {
  BufferGeometry,
  EllipseCurve,
  type Material,
  type Mesh,
  type Object3D,
  type Sprite,
} from 'three/webgpu';

/** A closed circle of points in the XY plane, for halos and construction lines. */
export function circle(radius: number, segments = 160): BufferGeometry {
  return new BufferGeometry().setFromPoints(
    new EllipseCurve(0, 0, radius, radius).getPoints(segments),
  );
}

/**
 * Dispose every geometry and material under `root` (shared materials only once).
 * Sprite geometry is skipped: three shares one quad across every Sprite.
 */
export function disposeObject(root: Object3D): void {
  const seen = new Set<Material>();
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!(object as Sprite).isSprite) mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : mesh.material
        ? [mesh.material]
        : [];
    for (const m of materials) {
      if (!seen.has(m)) {
        seen.add(m);
        m.dispose();
      }
    }
  });
}
