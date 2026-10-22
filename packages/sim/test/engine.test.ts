import { describe, expect, it } from 'vitest';
import { buildNavGrid } from '../src/navgrid';
import type { ArenaDef } from '../src/navgrid';
import { createWorld, step, TICK_HZ, toSnapshot } from '../src/engine';

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
