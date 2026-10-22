import { createRng } from '@raid-clinic/ui/space';
import type { Point } from './geometry';
import { distance } from './geometry';
import type { NavGrid } from './navgrid';
import { findPath } from './pathfinding';

/** Fixed simulation rate. Rendering interpolates between ticks; nothing in this package renders. */
export const TICK_HZ = 30;
const TICK_SECONDS = 1 / TICK_HZ;

export interface Entity {
  id: string;
  position: Point;
  /** Remaining waypoints to walk through, in order. Empty means idle. */
  path: Point[];
  /** Simulation units per second. */
  speed: number;
}

export interface World {
  tick: number;
  entities: Entity[];
  /** Deterministic PRNG, seeded at world creation. Unused by this package's own logic today — carried here for mechanics/bot-AI code (a later plan) to consume without inventing a second source of randomness. */
  rng: () => number;
}

/** Per-tick inputs: a move order replaces an entity's current path with a fresh one toward `destination`. */
export interface EngineInputs {
  moveOrders?: Record<string, Point>;
}

export interface Snapshot {
  tick: number;
  entities: Array<{ id: string; position: Point }>;
}

/**
 * Creates a new world at tick 0 from the given entities and RNG seed.
 * @param entities - initial entities; each is deep-cloned (position and path), so later mutation
 * of the input array/objects never affects the world
 * @param seed - seed for the world's deterministic PRNG; the same seed always produces the same
 * sequence of `rng()` values
 * @returns a fresh world at tick 0
 */
export function createWorld(entities: Entity[], seed: number): World {
  return {
    tick: 0,
    entities: entities.map((entity) => ({
      ...entity,
      position: { ...entity.position },
      path: [...entity.path],
    })),
    rng: createRng(seed),
  };
}

function advance(
  position: Point,
  path: Point[],
  distanceBudget: number,
): { position: Point; path: Point[] } {
  let current = position;
  let budget = distanceBudget;
  let remaining = path;
  while (remaining.length > 0 && budget > 0) {
    const [next, ...rest] = remaining;
    const segmentLength = distance(current, next);
    if (segmentLength <= budget) {
      budget -= segmentLength;
      current = next;
      remaining = rest;
    } else {
      const t = segmentLength === 0 ? 1 : budget / segmentLength;
      current = {
        x: current.x + (next.x - current.x) * t,
        y: current.y + (next.y - current.y) * t,
      };
      budget = 0;
    }
  }
  return { position: current, path: remaining };
}

/**
 * Advances the world by one fixed tick, in a fixed order: apply this tick's move orders (replacing
 * paths), then move every entity along its current path by `speed * TICK_SECONDS`.
 * @param world - the world to advance; not mutated
 * @param grid - the nav grid used to compute fresh paths for this tick's move orders
 * @param inputs - this tick's inputs (move orders)
 * @returns a new world, one tick further along
 */
export function step(world: World, grid: NavGrid, inputs: EngineInputs): World {
  const entities = world.entities.map((entity) => {
    const destination = inputs.moveOrders?.[entity.id];
    const path = destination ? findPath(grid, entity.position, destination) : entity.path;
    const budget = entity.speed * TICK_SECONDS;
    const { position, path: remainingPath } = advance(entity.position, path, budget);
    return { ...entity, position, path: remainingPath };
  });

  return { tick: world.tick + 1, entities, rng: world.rng };
}

/** Plain, renderer/HUD-facing view of the world's current state — see the design spec's "one-way, data-only" rule: renderer and HUD only ever read this, never the World itself. */
export function toSnapshot(world: World): Snapshot {
  return {
    tick: world.tick,
    entities: world.entities.map((entity) => ({ id: entity.id, position: entity.position })),
  };
}
