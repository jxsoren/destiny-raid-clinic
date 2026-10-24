import { describe, expect, it } from 'vitest';
import { overviewOffset, shapeFromPolygon } from '../../src/arena/ArenaRenderer';

describe('overviewOffset', () => {
  it('frames the real Atheon arena height with a visible ground span of height * 1.2', () => {
    const { elevation, setback } = overviewOffset(1000);

    // Reproduce the same frustum-edge-distance formula independently, rather than re-deriving the
    // implementation's internal steps, so this test would actually catch a regression to the old
    // ad hoc multipliers (which produced a far smaller elevation/setback than correct framing needs).
    const angle = (55 * Math.PI) / 180;
    const halfFov = (50 * Math.PI) / 360;
    const span = elevation * (1 / Math.tan(angle - halfFov) - 1 / Math.tan(angle + halfFov));
    expect(span).toBeCloseTo(1000 * 1.2, 5);

    // The down-angle implied by the resulting position (relative to a point directly below the
    // camera) must match the configured 55-degree camera angle.
    expect(Math.atan2(elevation, setback)).toBeCloseTo(angle, 5);
  });

  it('scales linearly with arena height', () => {
    const base = overviewOffset(1000);
    const doubled = overviewOffset(2000);
    expect(doubled.elevation).toBeCloseTo(base.elevation * 2, 5);
    expect(doubled.setback).toBeCloseTo(base.setback * 2, 5);
  });
});

describe('shapeFromPolygon', () => {
  it('negates y so the -90° X-rotation used by flatMesh maps sim-y onto +Z, matching every other mesh builder', () => {
    const shape = shapeFromPolygon([
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ]);
    const points = shape.getPoints();
    expect(points[0].x).toBe(1);
    expect(points[0].y).toBe(-2);
    expect(points[1].x).toBe(3);
    expect(points[1].y).toBe(-4);
  });
});
