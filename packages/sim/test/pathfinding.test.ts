import { describe, expect, it } from 'vitest';
import { buildNavGrid } from '../src/navgrid';
import type { ArenaDef } from '../src/navgrid';
import { findPath } from '../src/pathfinding';

const openRoom: ArenaDef = {
  width: 100,
  height: 100,
  walkable: [
    [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ],
  ],
  obstacles: [],
  walls: [],
};

describe('findPath', () => {
  it('returns a direct path across an open room', () => {
    const grid = buildNavGrid(openRoom, 5);
    const path = findPath(grid, { x: 5, y: 5 }, { x: 95, y: 95 });
    expect(path.length).toBeGreaterThan(0);
    const last = path[path.length - 1];
    expect(last.x).toBeCloseTo(95, 0);
    expect(last.y).toBeCloseTo(95, 0);
  });

  it('routes around a wall splitting the room, instead of cutting through it', () => {
    const arena: ArenaDef = {
      ...openRoom,
      walls: [
        [
          { x: 50, y: 0 },
          { x: 50, y: 80 },
        ],
      ],
    };
    const grid = buildNavGrid(arena, 5);
    const path = findPath(grid, { x: 10, y: 10 }, { x: 90, y: 10 });
    expect(path.length).toBeGreaterThan(0);
    const crossesWallBand = path.some((point) => point.x > 44 && point.x < 56 && point.y < 85);
    expect(crossesWallBand).toBe(false);
  });

  it('returns a single waypoint at the destination when start and destination share a walkable cell', () => {
    const grid = buildNavGrid(openRoom, 5);
    const path = findPath(grid, { x: 10, y: 10 }, { x: 11, y: 11 });
    expect(path).toEqual([{ x: 11, y: 11 }]);
  });

  it('returns an empty path when the destination is unreachable', () => {
    const arena: ArenaDef = {
      width: 100,
      height: 100,
      walkable: [
        [
          { x: 0, y: 0 },
          { x: 40, y: 0 },
          { x: 40, y: 100 },
          { x: 0, y: 100 },
        ],
        [
          { x: 60, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 60, y: 100 },
        ],
      ],
      obstacles: [],
      walls: [],
    };
    const grid = buildNavGrid(arena, 5);
    const path = findPath(grid, { x: 10, y: 10 }, { x: 90, y: 10 });
    expect(path).toEqual([]);
  });

  it('does not draw a line-of-sight shortcut through a thin wall when cellSize is small', () => {
    const arena: ArenaDef = {
      ...openRoom,
      walls: [
        [
          { x: 10, y: 0 },
          { x: 10, y: 15 },
        ],
      ],
    };
    const grid = buildNavGrid(arena, 1);
    const path = findPath(grid, { x: 5, y: 10 }, { x: 15, y: 10 });
    expect(path.length).toBeGreaterThan(0);

    // Walk every segment of the returned path at a fine resolution and confirm no sampled
    // point lands inside the 1-unit-wide wall band. A 1-unit-wide obstacle is reliably caught
    // by dense sampling (0.1 units here) but could plausibly be stepped over entirely by the
    // old fixed 3-unit sampling interval, which is exactly the bug this guards against.
    const full = [{ x: 5, y: 10 }, ...path];
    let crossesWall = false;
    for (let i = 0; i < full.length - 1; i++) {
      const a = full[i];
      const b = full[i + 1];
      const segLen = Math.hypot(b.x - a.x, b.y - a.y);
      const samples = Math.max(1, Math.ceil(segLen / 0.1));
      for (let s = 0; s <= samples; s++) {
        const t = s / samples;
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t;
        if (x > 9.5 && x < 10.5 && y < 15) crossesWall = true;
      }
    }
    expect(crossesWall).toBe(false);
  });
});
