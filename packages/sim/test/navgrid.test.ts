import { describe, expect, it } from 'vitest';
import { buildNavGrid, cellIndexAt, isWalkableAt } from '../src/navgrid';
import type { ArenaDef } from '../src/navgrid';

const openRoom: ArenaDef = {
  width: 20,
  height: 20,
  walkable: [
    [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 },
    ],
  ],
  obstacles: [],
  walls: [],
};

describe('buildNavGrid', () => {
  it('marks the interior of a walkable polygon as walkable', () => {
    const grid = buildNavGrid(openRoom, 5);
    expect(isWalkableAt(grid, 10, 10)).toBe(true);
  });

  it('marks points outside every walkable polygon as blocked', () => {
    const grid = buildNavGrid(openRoom, 5);
    expect(isWalkableAt(grid, 30, 30)).toBe(false);
  });

  it('marks points inside an obstacle as blocked even though they are inside the walkable area', () => {
    const arena: ArenaDef = {
      ...openRoom,
      obstacles: [
        [
          { x: 8, y: 8 },
          { x: 12, y: 8 },
          { x: 12, y: 12 },
          { x: 8, y: 12 },
        ],
      ],
    };
    const grid = buildNavGrid(arena, 5);
    expect(isWalkableAt(grid, 10, 10)).toBe(false);
    expect(isWalkableAt(grid, 2, 2)).toBe(true);
  });

  it('blocks a clearance radius around walls', () => {
    const arena: ArenaDef = {
      ...openRoom,
      walls: [
        [
          { x: 10, y: 0 },
          { x: 10, y: 20 },
        ],
      ],
    };
    const grid = buildNavGrid(arena, 1);
    expect(isWalkableAt(grid, 10, 10)).toBe(false);
    expect(isWalkableAt(grid, 2, 10)).toBe(true);
  });

  it('blocks a cell whose corner (but not its center) touches an obstacle, by design', () => {
    const arena: ArenaDef = {
      ...openRoom,
      obstacles: [
        [
          { x: 10, y: 10 },
          { x: 10.1, y: 10 },
          { x: 10.1, y: 10.1 },
          { x: 10, y: 10.1 },
        ],
      ],
    };
    const grid = buildNavGrid(arena, 5);
    // The cell spanning [10,15]x[10,15] has a corner at exactly (10,10), inside the tiny obstacle,
    // even though the obstacle covers almost none of the cell's area. Corner+center sampling
    // marks the whole cell blocked — the known conservative-approximation tradeoff from the JSDoc.
    expect(isWalkableAt(grid, 12, 12)).toBe(false);
  });
});

describe('cellIndexAt', () => {
  it('returns -1 outside the grid bounds', () => {
    const grid = buildNavGrid(openRoom, 5);
    expect(cellIndexAt(grid, -5, -5)).toBe(-1);
    expect(cellIndexAt(grid, 1000, 1000)).toBe(-1);
  });

  it('returns a valid index inside the grid bounds', () => {
    const grid = buildNavGrid(openRoom, 5);
    expect(cellIndexAt(grid, 10, 10)).toBeGreaterThanOrEqual(0);
  });
});
