import { describe, expect, it } from 'vitest';
import { distance, distanceToSegment, pointInPolygon } from '../src/geometry';

describe('pointInPolygon', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];

  it('returns true for a point inside the polygon', () => {
    expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
  });

  it('returns false for a point outside the polygon', () => {
    expect(pointInPolygon({ x: 15, y: 5 }, square)).toBe(false);
  });

  it('returns false for a point outside, even near an edge', () => {
    expect(pointInPolygon({ x: 10.5, y: 5 }, square)).toBe(false);
  });
});

describe('distanceToSegment', () => {
  it('is 0 for a point on the segment', () => {
    expect(distanceToSegment({ x: 5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(0);
  });

  it('measures perpendicular distance to the segment interior', () => {
    expect(distanceToSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(3);
  });

  it('measures distance to the nearest endpoint when beyond the segment', () => {
    expect(distanceToSegment({ x: -3, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(5);
  });

  it('measures straight-line distance to a degenerate (zero-length) segment', () => {
    expect(distanceToSegment({ x: 1, y: 1 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBeCloseTo(
      Math.SQRT2,
    );
  });
});

describe('distance', () => {
  it('is the straight-line distance between two points', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBeCloseTo(5);
  });
});
