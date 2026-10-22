// Public API of @raid-clinic/sim.
export { distance, distanceToSegment, pointInPolygon } from './geometry';
export type { Point } from './geometry';
export { buildNavGrid, cellIndexAt, isWalkableAt } from './navgrid';
export type { ArenaDef, NavGrid } from './navgrid';
export { findPath } from './pathfinding';
export { createWorld, step, TICK_HZ, toSnapshot } from './engine';
export type { Entity, EngineInputs, Snapshot, World } from './engine';
