// Render-time-only elevation lookup for Atheon's arena. @raid-clinic/sim's pathfinding never
// consults height (walkability doesn't depend on it), so this stays entirely in @raid-clinic/ui,
// parallel to but separate from @raid-clinic/sim's toArenaDef. See
// docs/superpowers/specs/2026-10-23-atheon-polish-elevation-design.md.
import type { Point } from '@raid-clinic/sim';
import { distanceToSegment, pointInPolygon } from '@raid-clinic/sim';

export interface LevelDef {
  id: string;
  polygon: Point[];
  height: number;
}

export interface StairDef {
  a: Point;
  b: Point;
  w: number;
  h0: number;
  h1: number;
}

export interface HallBand {
  y: number;
  height: number;
}

export interface ArenaLevels {
  levels: LevelDef[];
  stairs: StairDef[];
  hallBands: HallBand[];
}

/** The shape of encounter.json's `arena.levels`/`arena.stairs`/`arena.hallBands` fields, already
 * `JSON.parse`d. */
export interface EncounterLevelsContent {
  arena: {
    levels: LevelDef[];
    stairs: StairDef[];
    hallBands: HallBand[];
  };
}

/** Builds the `ArenaLevels` that `heightAt`/`hallBandSegments` expect from an encounter.json's
 * `arena` field. Does no file I/O — the caller reads and `JSON.parse`s the file first. */
export function toArenaLevels(content: EncounterLevelsContent): ArenaLevels {
  const { levels, stairs, hallBands } = content.arena;
  return { levels, stairs, hallBands };
}

/** The fraction (0-1, clamped) of the way from `a` to `b` that `point`'s perpendicular projection
 * falls, and the perpendicular distance from `point` to that projection. */
function projectOntoSegment(point: Point, a: Point, b: Point): { t: number; distance: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared
    ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared))
    : 0;
  return { t, distance: distanceToSegment(point, a, b) };
}

/** `hallBands` are expected sorted by `y` ascending, matching the prototype's own `HALL` constants
 * and this sub-project's content.json authoring. */
function hallBandHeightAt(y: number, hallBands: HallBand[]): number {
  if (hallBands.length === 0) return 0;
  const first = hallBands[0];
  if (y <= first.y) return first.height;
  const last = hallBands[hallBands.length - 1];
  if (y >= last.y) return last.height;
  for (let i = 0; i < hallBands.length - 1; i++) {
    const from = hallBands[i];
    const to = hallBands[i + 1];
    if (y >= from.y && y <= to.y) {
      const t = to.y === from.y ? 0 : (y - from.y) / (to.y - from.y);
      return from.height + (to.height - from.height) * t;
    }
  }
  return last.height;
}

/**
 * The world height at `point`, matching the prototype's `heightAt()` priority order: a `stairs`
 * ramp within its width wins first, then a containing `levels` polygon, then `hallBands` by `y` as
 * the final fallback.
 */
export function heightAt(
  point: Point,
  levels: LevelDef[],
  stairs: StairDef[],
  hallBands: HallBand[],
): number {
  for (const stair of stairs) {
    const { t, distance } = projectOntoSegment(point, stair.a, stair.b);
    if (distance <= stair.w / 2) return stair.h0 + (stair.h1 - stair.h0) * t;
  }
  for (const level of levels) {
    if (pointInPolygon(point, level.polygon)) return level.height;
  }
  return hallBandHeightAt(point.y, hallBands);
}

/** One Sutherland-Hodgman half-plane clip: keeps vertices satisfying `keep`, inserting the exact
 * boundary intersection wherever consecutive vertices disagree. */
function clipHalfPlane(points: Point[], keep: (p: Point) => boolean, boundaryY: number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const previous = points[(i - 1 + points.length) % points.length];
    const currentIn = keep(current);
    const previousIn = keep(previous);
    if (currentIn !== previousIn) {
      const t = (boundaryY - previous.y) / (current.y - previous.y);
      out.push({ x: previous.x + (current.x - previous.x) * t, y: boundaryY });
    }
    if (currentIn) out.push(current);
  }
  return out;
}

/**
 * Clips `polygon` to the horizontal band `yMin <= y <= yMax` (Sutherland-Hodgman — works for any
 * polygon shape). Either bound may be `undefined` for an unbounded clip.
 * @returns the clipped polygon, or `null` if fewer than 3 vertices survive (no intersection).
 */
export function clipPolygonByYRange(
  polygon: Point[],
  yMin: number | undefined,
  yMax: number | undefined,
): Point[] | null {
  let result = polygon;
  if (yMin !== undefined) result = clipHalfPlane(result, (p) => p.y >= yMin, yMin);
  if (yMax !== undefined && result.length > 0) {
    result = clipHalfPlane(result, (p) => p.y <= yMax, yMax);
  }
  return result.length >= 3 ? result : null;
}

/**
 * Slices `polygon` into one sub-polygon per `hallBands` segment (plus the two unbounded ends),
 * each paired with that segment's representative height: a flat segment between two equal-height
 * breakpoints keeps that height; a sloped segment between two different-height breakpoints is
 * approximated as one flat band at their average height (a cosmetic simplification — `heightAt()`
 * still returns the true interpolated height for any point in this range).
 */
export function hallBandSegments(
  polygon: Point[],
  hallBands: HallBand[],
): Array<{ polygon: Point[]; height: number }> {
  if (hallBands.length === 0) return [];

  const segments: Array<{ yMin: number | undefined; yMax: number | undefined; height: number }> = [
    { yMin: undefined, yMax: hallBands[0].y, height: hallBands[0].height },
  ];
  for (let i = 0; i < hallBands.length - 1; i++) {
    const from = hallBands[i];
    const to = hallBands[i + 1];
    segments.push({ yMin: from.y, yMax: to.y, height: (from.height + to.height) / 2 });
  }
  const last = hallBands[hallBands.length - 1];
  segments.push({ yMin: last.y, yMax: undefined, height: last.height });

  const out: Array<{ polygon: Point[]; height: number }> = [];
  for (const segment of segments) {
    const clipped = clipPolygonByYRange(polygon, segment.yMin, segment.yMax);
    if (clipped) out.push({ polygon: clipped, height: segment.height });
  }
  return out;
}
