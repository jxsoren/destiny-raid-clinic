import type { Point } from './geometry';
import { distance } from './geometry';
import type { NavGrid } from './navgrid';
import { cellIndexAt, isWalkableAt } from './navgrid';

function nearestWalkableCell(grid: NavGrid, index: number): number {
  if (index >= 0 && grid.cells[index] === 1) return index;
  const col0 = index >= 0 ? index % grid.cols : Math.floor(grid.cols / 2);
  const row0 = index >= 0 ? Math.floor(index / grid.cols) : Math.floor(grid.rows / 2);
  const maxRadius = Math.max(grid.cols, grid.rows);
  for (let radius = 1; radius < maxRadius; radius++) {
    for (let dRow = -radius; dRow <= radius; dRow++) {
      for (let dCol = -radius; dCol <= radius; dCol++) {
        if (Math.max(Math.abs(dCol), Math.abs(dRow)) !== radius) continue;
        const col = col0 + dCol;
        const row = row0 + dRow;
        if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) continue;
        const candidate = row * grid.cols + col;
        if (grid.cells[candidate] === 1) return candidate;
      }
    }
  }
  return -1;
}

/** Samples along the segment `a`-`b` at half the grid's cell size, so no blocked cell can be
 * stepped over between samples, regardless of how small `cellSize` is. */
function hasLineOfSight(grid: NavGrid, a: Point, b: Point): boolean {
  const interval = grid.cellSize / 2;
  const steps = Math.ceil(distance(a, b) / interval);
  for (let step = 1; step <= steps; step++) {
    const t = step / steps;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    if (!isWalkableAt(grid, x, y)) return false;
  }
  return true;
}

/** Binary min-heap of (priority, cell) pairs, used only by findPath's open set. */
class MinHeap {
  private items: Array<[number, number]> = [];

  push(cell: number, priority: number): void {
    this.items.push([priority, cell]);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent][0] <= this.items[i][0]) break;
      [this.items[parent], this.items[i]] = [this.items[i], this.items[parent]];
      i = parent;
    }
  }

  pop(): [number, number] | undefined {
    const top = this.items[0];
    const last = this.items.pop();
    if (last && this.items.length) {
      this.items[0] = last;
      let i = 0;
      for (;;) {
        const left = 2 * i + 1;
        const right = left + 1;
        let smallest = i;
        if (left < this.items.length && this.items[left][0] < this.items[smallest][0])
          smallest = left;
        if (right < this.items.length && this.items[right][0] < this.items[smallest][0])
          smallest = right;
        if (smallest === i) break;
        [this.items[smallest], this.items[i]] = [this.items[i], this.items[smallest]];
        i = smallest;
      }
    }
    return top;
  }

  get size(): number {
    return this.items.length;
  }
}

/**
 * A* search over the nav grid (8-directional, corners blocked when either adjacent orthogonal
 * cell is blocked), then simplified to waypoints using line-of-sight shortcuts.
 * @param grid - the nav grid to search over
 * @param from - the starting point (need not be exactly on a walkable cell's center)
 * @param to - the destination point
 * @returns a list of waypoints from `from` to `to`, or `[]` if neither point is near any walkable
 * cell, or no path connects them
 */
export function findPath(grid: NavGrid, from: Point, to: Point): Point[] {
  const start = nearestWalkableCell(grid, cellIndexAt(grid, from.x, from.y));
  const goal = nearestWalkableCell(grid, cellIndexAt(grid, to.x, to.y));
  if (start < 0 || goal < 0) return [];

  const count = grid.cols * grid.rows;
  const gScore = new Float32Array(count).fill(Infinity);
  const cameFrom = new Int32Array(count).fill(-1);
  const closed = new Uint8Array(count);
  const goalCol = goal % grid.cols;
  const goalRow = Math.floor(goal / grid.cols);
  const heuristic = (cell: number): number => {
    const dCol = Math.abs((cell % grid.cols) - goalCol);
    const dRow = Math.abs(Math.floor(cell / grid.cols) - goalRow);
    return Math.max(dCol, dRow) + 0.414 * Math.min(dCol, dRow);
  };

  const open = new MinHeap();
  gScore[start] = 0;
  open.push(start, heuristic(start));

  while (open.size) {
    const entry = open.pop();
    if (!entry) break;
    const [, current] = entry;
    if (current === goal) break;
    if (closed[current]) continue;
    closed[current] = 1;

    const col = current % grid.cols;
    const row = Math.floor(current / grid.cols);
    for (let dRow = -1; dRow <= 1; dRow++) {
      for (let dCol = -1; dCol <= 1; dCol++) {
        if (!dCol && !dRow) continue;
        const nCol = col + dCol;
        const nRow = row + dRow;
        if (nCol < 0 || nRow < 0 || nCol >= grid.cols || nRow >= grid.rows) continue;
        const neighbor = nRow * grid.cols + nCol;
        if (!grid.cells[neighbor] || closed[neighbor]) continue;
        if (dCol && dRow) {
          const cornerA = row * grid.cols + nCol;
          const cornerB = nRow * grid.cols + col;
          if (!grid.cells[cornerA] || !grid.cells[cornerB]) continue;
        }
        const stepCost = dCol && dRow ? 1.414 : 1;
        const tentative = gScore[current] + stepCost;
        if (tentative < gScore[neighbor]) {
          gScore[neighbor] = tentative;
          cameFrom[neighbor] = current;
          open.push(neighbor, tentative + heuristic(neighbor));
        }
      }
    }
  }

  if (start !== goal && cameFrom[goal] < 0) return [];

  const cells: number[] = [];
  for (let cell = goal; cell >= 0 && cell !== start; cell = cameFrom[cell]) cells.push(cell);
  cells.reverse();

  const points = cells.map((cell) => ({
    x: (cell % grid.cols) * grid.cellSize + grid.cellSize / 2,
    y: Math.floor(cell / grid.cols) * grid.cellSize + grid.cellSize / 2,
  }));
  points.push(to);

  const waypoints: Point[] = [];
  let cursor = from;
  for (let i = 0; i < points.length; i++) {
    if (i === points.length - 1 || !hasLineOfSight(grid, cursor, points[i + 1])) {
      waypoints.push(points[i]);
      cursor = points[i];
    }
  }
  return waypoints;
}
