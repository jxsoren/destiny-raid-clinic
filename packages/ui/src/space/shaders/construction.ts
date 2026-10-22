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
import { circle } from './geometry';
import { LINE } from './palette';

const points = (pts: [number, number][]) =>
  new BufferGeometry().setFromPoints(pts.map(([x, y]) => new Vector2(x, y)));

export function createConstruction(aspect: number): Group {
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

  group.add(
    new LineSegments(
      points([
        [-aspect, 0],
        [aspect, 0],
        [0, -1],
        [0, 1],
      ]),
      solid,
    ),
  );
  group.add(new Line(circle(0.82), solid));
  const ring = new Line(circle(0.6), dashed);
  ring.computeLineDistances();
  group.add(ring);
  for (const side of [-1, 1]) {
    const x = side * (aspect - 0.07);
    const s = 0.03;
    group.add(
      new Line(
        points([
          [x, s],
          [x + s, 0],
          [x, -s],
          [x - s, 0],
          [x, s],
        ]),
        solid,
      ),
    );
  }
  group.position.z = -10;
  return group;
}
