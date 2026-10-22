// Construction geometry in thin white lines at low opacity: a crosshair, one large circle, one dashed
// circle and diamond markers at the left and right edges (spec §4).
import {
  BufferGeometry,
  Group,
  Line,
  LineBasicNodeMaterial,
  LineDashedNodeMaterial,
  LineSegments,
  Vector2,
} from 'three/webgpu';
import { circle, disposeObject } from './geometry';
import { LINE } from './palette';

const points = (pts: [number, number][]) =>
  new BufferGeometry().setFromPoints(pts.map(([x, y]) => new Vector2(x, y)));

export interface Construction {
  group: Group;
  /** Fit the horizontal crosshair and edge diamonds to the viewport aspect (width / height). */
  setAspect(aspect: number): void;
  dispose(): void;
}

export function createConstruction(): Construction {
  const group = new Group();
  const solid = new LineBasicNodeMaterial({
    color: LINE,
    transparent: true,
    opacity: 0.07,
    depthTest: false,
  });
  const dashed = new LineDashedNodeMaterial({
    color: LINE,
    transparent: true,
    opacity: 0.09,
    dashSize: 0.018,
    gapSize: 0.018,
    depthTest: false,
  });

  // Built once at aspect 1; setAspect only scales/moves these two.
  const horizontal = new LineSegments(
    points([
      [-1, 0],
      [1, 0],
    ]),
    solid,
  );
  const vertical = new LineSegments(
    points([
      [0, -1],
      [0, 1],
    ]),
    solid,
  );
  group.add(horizontal, vertical);
  group.add(new Line(circle(0.82), solid));
  const ring = new Line(circle(0.6), dashed);
  ring.computeLineDistances();
  group.add(ring);
  const diamonds: Line[] = [];
  const s = 0.03;
  for (const side of [-1, 1]) {
    // Closed with a repeated first point: the node renderer has no LineLoop.
    const diamond = new Line(
      points([
        [0, s],
        [s, 0],
        [0, -s],
        [-s, 0],
        [0, s],
      ]),
      solid,
    );
    diamond.userData.side = side;
    diamonds.push(diamond);
    group.add(diamond);
  }
  group.position.z = -10;

  const setAspect = (aspect: number) => {
    horizontal.scale.x = aspect;
    for (const d of diamonds) d.position.x = (d.userData.side as number) * (aspect - 0.07);
  };
  setAspect(1);

  return { group, setAspect, dispose: () => disposeObject(group) };
}
