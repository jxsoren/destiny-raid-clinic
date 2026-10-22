/** A 2D point in simulation units (arbitrary, consistent per-arena units — see each arena's data). */
export interface Point {
  x: number;
  y: number;
}

/**
 * Ray-casting point-in-polygon test.
 * @param point - the point to test
 * @param polygon - ordered vertices (not closed — no repeated first/last point); any winding order
 * @returns true if `point` lies inside `polygon`, false if outside or exactly on a non-crossing edge
 */
export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses = a.y > point.y !== b.y > point.y;
    if (crosses && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Shortest distance from `point` to the segment `a`-`b`. If `a` and `b` are the same point
 * (a degenerate, zero-length segment), returns the straight-line distance from `point` to `a`.
 * @param point - the point to measure from
 * @param a - one endpoint of the segment
 * @param b - the other endpoint of the segment
 * @returns the shortest distance from `point` to the segment
 */
export function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  let t = lengthSquared ? ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

/**
 * Straight-line distance between two points.
 * @param a - the first point
 * @param b - the second point
 * @returns the Euclidean distance between `a` and `b`
 */
export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
