import type { Point } from '../geometry';
import { distance } from '../geometry';
import type { World } from '../engine';

/** A circular "stand here to hold" zone — sync plates, DPS plates, add-clear zones, etc. */
export interface PlateConfig {
  id: string;
  position: Point;
  radius: number;
}

export interface PlateState {
  held: boolean;
  heldBy: string | null;
}

/** A plate starts unheld. */
export function initPlateState(): PlateState {
  return { held: false, heldBy: null };
}

/**
 * A plate is held by the first entity (in `world.entities` order) standing within `config.radius`
 * of `config.position`, or unheld if no entity qualifies.
 * @param config - the plate's position and radius
 * @param world - the current world, read for entity positions only (never mutated)
 * @returns this tick's plate state
 */
export function stepPlate(config: PlateConfig, world: World): PlateState {
  const holder = world.entities.find(
    (entity) => distance(entity.position, config.position) <= config.radius,
  );
  return holder ? { held: true, heldBy: holder.id } : { held: false, heldBy: null };
}
