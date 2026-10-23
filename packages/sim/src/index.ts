// Public API of @raid-clinic/sim.

export type {
  EncounterArenaContent,
  EncounterMechanicsContent,
  MechanicContentEntry,
} from './content';
export { toArenaDef, toMechanicsConfig } from './content';
export type { EngineInputs, Entity, Snapshot, World } from './engine';
export { createWorld, step, TICK_HZ, toSnapshot } from './engine';
export type { Point } from './geometry';
export { distance, distanceToSegment, pointInPolygon } from './geometry';
export type {
  CalloutEvent,
  EncounterMechanicsConfig,
  MechanicsState,
  PlateConfig,
  PlateState,
  SequenceCalloutConfig,
  SequenceCalloutState,
  WipeCondition,
  WipeTimerState,
} from './mechanics';
export { createMechanicsState, stepMechanics } from './mechanics';
export type { ArenaDef, NavGrid } from './navgrid';
export { buildNavGrid, cellIndexAt, isWalkableAt } from './navgrid';
export { findPath } from './pathfinding';
