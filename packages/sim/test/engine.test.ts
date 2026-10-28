import { describe, expect, it } from 'vitest';
import { createWorld, step, TICK_HZ, toSnapshot } from '../src/engine';
import type { ArenaDef } from '../src/navgrid';
import { buildNavGrid } from '../src/navgrid';

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

describe('createWorld', () => {
  it('starts at tick 0 with the given entities, cloned (not aliased)', () => {
    const entity = { id: 'bot-1', position: { x: 1, y: 1 }, path: [], speed: 10 };
    const world = createWorld([entity], 1);
    expect(world.tick).toBe(0);
    expect(world.entities[0]).not.toBe(entity);
    expect(world.entities[0].position).toEqual({ x: 1, y: 1 });
  });

  it('gives the same seed the same first RNG value', () => {
    const worldA = createWorld([], 42);
    const worldB = createWorld([], 42);
    expect(worldA.rng()).toBe(worldB.rng());
  });
});

describe('step', () => {
  const grid = buildNavGrid(openRoom, 5);

  it('increments the tick counter', () => {
    const world = createWorld([], 1);
    const next = step(world, grid, {});
    expect(next.tick).toBe(1);
  });

  it('moves an entity toward a move order destination, one tick at a time', () => {
    const entity = { id: 'bot-1', position: { x: 10, y: 10 }, path: [], speed: 30 };
    let world = createWorld([entity], 1);
    world = step(world, grid, { moveOrders: { 'bot-1': { x: 40, y: 10 } } });
    const moved = world.entities[0];
    expect(moved.position.x).toBeGreaterThan(10);
    expect(moved.position.x).toBeLessThan(40);
  });

  it('reaches the destination after enough ticks and then stops', () => {
    const entity = { id: 'bot-1', position: { x: 10, y: 10 }, path: [], speed: 30 };
    let world = createWorld([entity], 1);
    world = step(world, grid, { moveOrders: { 'bot-1': { x: 40, y: 10 } } });
    for (let i = 0; i < 50; i++) {
      world = step(world, grid, {});
    }
    const settled = world.entities[0];
    expect(settled.position.x).toBeCloseTo(40, 0);
    expect(settled.position.y).toBeCloseTo(10, 0);
  });

  it('does not move an entity with no path and no move order', () => {
    const entity = { id: 'bot-1', position: { x: 10, y: 10 }, path: [], speed: 30 };
    let world = createWorld([entity], 1);
    world = step(world, grid, {});
    expect(world.entities[0].position).toEqual({ x: 10, y: 10 });
  });
});

describe('toSnapshot', () => {
  it('produces a plain, renderer-facing view of tick and entity positions', () => {
    const entity = { id: 'bot-1', position: { x: 5, y: 5 }, path: [], speed: 10 };
    const world = createWorld([entity], 1);
    const snapshot = toSnapshot(world);
    expect(snapshot).toEqual({ tick: 0, entities: [{ id: 'bot-1', position: { x: 5, y: 5 } }] });
  });
});

describe('TICK_HZ', () => {
  it('is 30, matching the prototype render-interpolation assumption', () => {
    expect(TICK_HZ).toBe(30);
  });
});

describe('step with moveDirect', () => {
  const grid = buildNavGrid(openRoom, 5);

  it('moves an entity by a direction vector, scaled by speed and normalized', () => {
    const entity = { id: 'bot-1', position: { x: 50, y: 50 }, path: [], speed: 30 };
    let world = createWorld([entity], 1);
    world = step(world, grid, { moveDirect: { 'bot-1': { dx: 1, dy: 0 } } });
    const moved = world.entities[0];
    expect(moved.position.x).toBeCloseTo(51, 5);
    expect(moved.position.y).toBeCloseTo(50, 5);
  });

  it('normalizes a diagonal direction so it moves no faster than an axis-aligned one', () => {
    const entity = { id: 'bot-1', position: { x: 50, y: 50 }, path: [], speed: 30 };
    let world = createWorld([entity], 1);
    world = step(world, grid, { moveDirect: { 'bot-1': { dx: 1, dy: 1 } } });
    const moved = world.entities[0];
    const traveled = Math.hypot(moved.position.x - 50, moved.position.y - 50);
    expect(traveled).toBeCloseTo(1, 5);
  });

  it('slides along one axis when the full diagonal move is blocked', () => {
    const wallArena: ArenaDef = {
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
      obstacles: [
        [
          { x: 53, y: 53 },
          { x: 100, y: 53 },
          { x: 100, y: 100 },
          { x: 53, y: 100 },
        ],
      ],
      walls: [],
    };
    const wallGrid = buildNavGrid(wallArena, 5);
    // Moving down-right from (49, 49) at this speed (budget 8/tick) would land at (54.66, 54.66),
    // solidly inside the obstacle's grid cell; sliding along X (moving right only, y held at 49)
    // keeps y below the obstacle's row entirely, landing in open space.
    const entity = { id: 'bot-1', position: { x: 49, y: 49 }, path: [], speed: 240 };
    let world = createWorld([entity], 1);
    world = step(world, wallGrid, { moveDirect: { 'bot-1': { dx: 1, dy: 1 } } });
    const moved = world.entities[0];
    expect(moved.position.x).toBeGreaterThan(49);
    expect(moved.position.y).toBeCloseTo(49, 5);
  });

  it('stays in place when every direction is blocked', () => {
    const boxedArena: ArenaDef = {
      width: 100,
      height: 100,
      walkable: [
        [
          { x: 40, y: 40 },
          { x: 100, y: 40 },
          { x: 100, y: 100 },
          { x: 40, y: 100 },
        ],
      ],
      obstacles: [],
      walls: [],
    };
    const boxedGrid = buildNavGrid(boxedArena, 5);
    // Starting at (45, 45), well inside the walkable square, this speed (budget 14/tick) pushes
    // the full diagonal, X-only, and Y-only targets all down to ~35.1 — solidly past the square's
    // x=40/y=40 boundary and into unwalkable space — so every candidate move is blocked and the
    // entity doesn't move at all.
    const entity = { id: 'bot-1', position: { x: 45, y: 45 }, path: [], speed: 420 };
    let world = createWorld([entity], 1);
    world = step(world, boxedGrid, { moveDirect: { 'bot-1': { dx: -1, dy: -1 } } });
    const moved = world.entities[0];
    expect(moved.position).toEqual({ x: 45, y: 45 });
  });

  it('clears an in-flight path when moveDirect takes over mid-path', () => {
    const entity = { id: 'bot-1', position: { x: 10, y: 10 }, path: [{ x: 50, y: 10 }], speed: 30 };
    let world = createWorld([entity], 1);
    world = step(world, grid, { moveDirect: { 'bot-1': { dx: 1, dy: 0 } } });
    const moved = world.entities[0];
    expect(moved.path).toEqual([]);
  });

  it('prefers a moveOrders destination over a simultaneous moveDirect for the same entity', () => {
    const entity = { id: 'bot-1', position: { x: 10, y: 10 }, path: [], speed: 30 };
    let world = createWorld([entity], 1);
    world = step(world, grid, {
      moveOrders: { 'bot-1': { x: 40, y: 10 } },
      moveDirect: { 'bot-1': { dx: 0, dy: -1 } },
    });
    const moved = world.entities[0];
    // Moving toward (40, 10) increases x; moveDirect alone (dy: -1) would decrease y instead.
    expect(moved.position.x).toBeGreaterThan(10);
    expect(moved.position.y).toBe(10);
  });
});
