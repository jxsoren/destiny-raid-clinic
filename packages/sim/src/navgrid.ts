import type { Point } from './geometry';
import { distanceToSegment, pointInPolygon } from './geometry';

/** Arena shape in simulation units. `walkable` polygons are unioned, `obstacles` are subtracted, `walls` block a clearance radius around themselves. */
export interface ArenaDef {
  width: number;
  height: number;
  walkable: Point[][];
  obstacles: Point[][];
  walls: Array<[Point, Point]>;
}

export interface NavGrid {
  cellSize: number;
  cols: number;
  rows: number;
  /** 1 = walkable, 0 = blocked. Row-major: index = row * cols + col. */
  cells: Uint8Array;
}

const WALL_CLEARANCE = 4;

function isRawWalkable(arena: ArenaDef, point: Point): boolean {
  const inWalkableArea = arena.walkable.some((polygon) => pointInPolygon(point, polygon));
  if (!inWalkableArea) return false;
  if (arena.obstacles.some((polygon) => pointInPolygon(point, polygon))) return false;
  for (const [a, b] of arena.walls) {
    if (distanceToSegment(point, a, b) < WALL_CLEARANCE) return false;
  }
  return true;
}

/**
 * Rasterizes an arena into a uniform grid of walkable/blocked cells, by sampling each cell's 4
 * corners plus its center (5 points) against the arena's walkable/obstacle/wall data — a cell is
 * walkable only if every sample point is.
 *
 * This is a conservative point-sampling approximation, not an exact area test: an obstacle or
 * wall that only touches one corner of an otherwise-open cell will mark the whole cell blocked,
 * and a small obstacle sitting entirely inside a cell's interior — missing all 5 sample points —
 * can go undetected. Shrink `cellSize` for tighter fidelity if this matters for a given arena.
 * @param arena - the arena definition (walkable polygons, obstacles, walls) in simulation units
 * @param cellSize - the side length of each square grid cell, in the same units as the arena
 * @returns a NavGrid whose cells are 1 where every sample point is walkable, 0 otherwise
 */
export function buildNavGrid(arena: ArenaDef, cellSize: number): NavGrid {
  const cols = Math.ceil(arena.width / cellSize);
  const rows = Math.ceil(arena.height / cellSize);
  const cells = new Uint8Array(cols * rows);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x0 = col * cellSize;
      const y0 = row * cellSize;
      const x1 = x0 + cellSize;
      const y1 = y0 + cellSize;
      const clear =
        isRawWalkable(arena, { x: x0, y: y0 }) &&
        isRawWalkable(arena, { x: x1, y: y0 }) &&
        isRawWalkable(arena, { x: x0, y: y1 }) &&
        isRawWalkable(arena, { x: x1, y: y1 }) &&
        isRawWalkable(arena, { x: (x0 + x1) / 2, y: (y0 + y1) / 2 });
      cells[row * cols + col] = clear ? 1 : 0;
    }
  }

  return { cellSize, cols, rows, cells };
}

/**
 * Looks up the flat cell index for a world position.
 * @param grid - the nav grid to index into
 * @param x - world x coordinate
 * @param y - world y coordinate
 * @returns the row-major cell index, or -1 if the position falls outside the grid's bounds
 */
export function cellIndexAt(grid: NavGrid, x: number, y: number): number {
  const col = Math.floor(x / grid.cellSize);
  const row = Math.floor(y / grid.cellSize);
  if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) return -1;
  return row * grid.cols + col;
}

/**
 * Checks whether a world position falls in a walkable cell.
 * @param grid - the nav grid to query
 * @param x - world x coordinate
 * @param y - world y coordinate
 * @returns true if the position is inside the grid and its cell is walkable, false otherwise
 */
export function isWalkableAt(grid: NavGrid, x: number, y: number): boolean {
  const index = cellIndexAt(grid, x, y);
  return index >= 0 && grid.cells[index] === 1;
}
