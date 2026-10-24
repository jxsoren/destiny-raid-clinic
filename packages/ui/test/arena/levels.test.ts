import { describe, expect, it } from 'vitest';
import {
  clipPolygonByYRange,
  hallBandSegments,
  heightAt,
  toArenaLevels,
  type HallBand,
  type LevelDef,
  type StairDef,
} from '../../src/arena/levels';

const levels: LevelDef[] = [
  {
    id: 'platform',
    height: 1.5,
    polygon: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ],
  },
];

const stairs: StairDef[] = [
  { a: { x: 20, y: 5 }, b: { x: 30, y: 5 }, w: 4, h0: 0, h1: 2 },
];

const hallBands: HallBand[] = [
  { y: 100, height: 2 },
  { y: 120, height: 1 },
  { y: 140, height: 1 },
  { y: 160, height: 0 },
];

describe('heightAt', () => {
  it('returns a level polygon height for a point inside it', () => {
    expect(heightAt({ x: 5, y: 5 }, levels, [], [])).toBe(1.5);
  });

  it('interpolates a stairs ramp from h0 at a to h1 at b', () => {
    expect(heightAt({ x: 20, y: 5 }, [], stairs, [])).toBe(0);
    expect(heightAt({ x: 25, y: 5 }, [], stairs, [])).toBe(1);
    expect(heightAt({ x: 30, y: 5 }, [], stairs, [])).toBe(2);
  });

  it('ignores a stairs ramp when the point is beyond its width', () => {
    expect(heightAt({ x: 25, y: 20 }, [], stairs, hallBands)).not.toBe(1);
  });

  it('prefers a stairs ramp over a level polygon it overlaps', () => {
    const overlappingLevel: LevelDef[] = [
      { id: 'under-stair', height: 99, polygon: [
        { x: 15, y: 0 }, { x: 35, y: 0 }, { x: 35, y: 10 }, { x: 15, y: 10 },
      ] },
    ];
    expect(heightAt({ x: 25, y: 5 }, overlappingLevel, stairs, [])).toBe(1);
  });

  it('falls back to hallBands when neither a level nor a stairs ramp matches', () => {
    expect(heightAt({ x: 500, y: 100 }, [], [], hallBands)).toBe(2);
    expect(heightAt({ x: 500, y: 110 }, [], [], hallBands)).toBe(1.5);
    expect(heightAt({ x: 500, y: 130 }, [], [], hallBands)).toBe(1);
    expect(heightAt({ x: 500, y: 150 }, [], [], hallBands)).toBe(0.5);
  });

  it('clamps hallBands beyond the first and last breakpoint', () => {
    expect(heightAt({ x: 500, y: 0 }, [], [], hallBands)).toBe(2);
    expect(heightAt({ x: 500, y: 9999 }, [], [], hallBands)).toBe(0);
  });

  it('defaults to 0 when there are no hallBands at all', () => {
    expect(heightAt({ x: 500, y: 100 }, [], [], [])).toBe(0);
  });
});

describe('clipPolygonByYRange', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];

  it('returns the whole polygon when the band fully contains it', () => {
    expect(clipPolygonByYRange(square, -5, 15)).toEqual(square);
  });

  it('clips a polygon straddling the band edge to a smaller shape', () => {
    const clipped = clipPolygonByYRange(square, undefined, 5);
    expect(clipped).not.toBeNull();
    for (const point of clipped ?? []) expect(point.y).toBeLessThanOrEqual(5);
    // The clipped shape still spans the full original width at y=0 and y=5.
    expect(clipped?.some((p) => p.x === 0)).toBe(true);
    expect(clipped?.some((p) => p.x === 10)).toBe(true);
  });

  it('returns null when the band does not intersect the polygon at all', () => {
    expect(clipPolygonByYRange(square, 20, 30)).toBeNull();
  });
});

describe('hallBandSegments', () => {
  const corridor = [
    { x: 0, y: 90 },
    { x: 10, y: 90 },
    { x: 10, y: 170 },
    { x: 0, y: 170 },
  ];

  it('produces one segment per hallBands gap plus the two unbounded ends', () => {
    const segments = hallBandSegments(corridor, hallBands);
    expect(segments).toHaveLength(5);
  });

  it('gives a flat segment between two equal-height breakpoints that exact height', () => {
    const segments = hallBandSegments(corridor, hallBands);
    const flatHall = segments.find((s) => s.polygon.every((p) => p.y >= 120 && p.y <= 140));
    expect(flatHall?.height).toBe(1);
  });

  it('gives a sloped segment the average of its two breakpoints', () => {
    const segments = hallBandSegments(corridor, hallBands);
    const slope = segments.find((s) => s.polygon.every((p) => p.y >= 100 && p.y <= 120));
    expect(slope?.height).toBe(1.5);
  });

  it('returns an empty list when there are no hallBands', () => {
    expect(hallBandSegments(corridor, [])).toEqual([]);
  });
});

describe('toArenaLevels', () => {
  it('extracts levels/stairs/hallBands from the encounter content', () => {
    const content = { arena: { levels, stairs, hallBands } };
    expect(toArenaLevels(content)).toEqual({ levels, stairs, hallBands });
  });
});
