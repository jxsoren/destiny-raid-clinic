// A hardcoded, looping script driving one bot entity through the real engine/mechanics pipeline:
// walk to the Mars plate, submit the three scripted Oracle-order callouts, then reset. No rendering,
// no input — see docs/superpowers/specs/2026-10-23-atheon-entities-mechanics-feedback-design.md.
//
// Atheon's real content also wipes if the Venus plate isn't held within its own grace period
// (`venus-plate-check`), independently of the Mars plate — a real wipe condition the design doc's
// "always a clean success" script didn't account for. When the config has a `venus-plate`, a second
// scripted entity walks there too so neither plate's grace period ever expires. Configs without a
// `venus-plate` (e.g. this file's own unit tests) get the original single-entity behavior.
import type {
  CalloutEvent,
  EncounterMechanicsConfig,
  MechanicsState,
  NavGrid,
  Point,
  World,
} from '@raid-clinic/sim';
import { createMechanicsState, createWorld, step, stepMechanics, TICK_HZ } from '@raid-clinic/sim';

/** Seconds per engine tick. */
export const TICK_SECONDS = 1 / TICK_HZ;
/** Sim units per second the scripted entity walks. */
const ENTITY_SPEED = 60;
/** The scripted entity's id in the world. */
export const ENTITY_ID = 'bot';
/** The second scripted entity's id, used only when the config has a `venus-plate`. */
export const ENTITY_ID_VENUS = 'bot-venus';
/** The callout mechanic's id in Atheon's real content — this script is specific to that content. */
const ORACLE_CALLOUT_ID = 'oracle-order';
/** The whole script repeats after this many seconds. */
export const LOOP_SECONDS = 16;
const LOOP_TICKS = LOOP_SECONDS * TICK_HZ;

/** Tick offsets (in ticks, not seconds, to avoid floating-point drift from repeated addition) at
 * which each scripted Oracle-order callout fires. */
const CALLOUT_SCRIPT: Array<{ tick: number; value: string }> = [
  { tick: 6 * TICK_HZ, value: 'oracle-2' },
  { tick: 8 * TICK_HZ, value: 'oracle-5' },
  { tick: 10 * TICK_HZ, value: 'oracle-1' },
];

/** Tick at which the post-success "win" window begins (10s), lasting until the loop resets (16s). */
export const WIN_WINDOW_START_TICK = 10 * TICK_HZ;

export interface ScenarioState {
  world: World;
  mechanics: MechanicsState;
  /** Ticks elapsed since the scenario last started (0 right after `createScenarioState`/a reset). */
  tick: number;
  rally: Point;
}

function marsPlatePosition(config: EncounterMechanicsConfig): Point {
  const plate = config.plates.find((p) => p.id === 'mars-plate');
  if (!plate) {
    throw new Error("Scenario script requires a 'mars-plate' plate in the mechanics config");
  }
  return plate.position;
}

/** `venus-plate`'s position, or `undefined` if `config` has no such plate (e.g. a synthetic
 * single-plate test config) — the second entity is only spawned/moved when this is present. */
function venusPlatePosition(config: EncounterMechanicsConfig): Point | undefined {
  return config.plates.find((p) => p.id === 'venus-plate')?.position;
}

/** Builds the scenario's starting state: a world with one entity at `rally` (plus a second at
 * `rally` too, when `config` has a `venus-plate`), and fresh mechanics state for `config`. */
export function createScenarioState(config: EncounterMechanicsConfig, rally: Point): ScenarioState {
  const entities = [{ id: ENTITY_ID, position: { ...rally }, path: [], speed: ENTITY_SPEED }];
  if (venusPlatePosition(config)) {
    entities.push({ id: ENTITY_ID_VENUS, position: { ...rally }, path: [], speed: ENTITY_SPEED });
  }
  return {
    world: createWorld(entities, 1),
    mechanics: createMechanicsState(config),
    tick: 0,
    rally,
  };
}

/**
 * Advances the scenario by exactly one engine tick: applies this tick's scripted action (if any),
 * steps the engine and mechanics, and resets back to the start once `LOOP_SECONDS` is reached.
 * @param grid - the nav grid for the real arena, used to path the entity to the Mars plate
 * @param config - the encounter's mechanics config (the script looks up the Mars plate's position
 * from `config.plates` directly, rather than taking it as a separate parameter)
 * @param state - the scenario's state before this tick
 * @returns this tick's resulting state
 */
export function stepScenario(
  grid: NavGrid,
  config: EncounterMechanicsConfig,
  state: ScenarioState,
): ScenarioState {
  const tick = state.tick + 1;
  if (tick >= LOOP_TICKS) return createScenarioState(config, state.rally);

  const venusPosition = venusPlatePosition(config);
  const moveOrders =
    state.tick === 0
      ? {
          [ENTITY_ID]: marsPlatePosition(config),
          ...(venusPosition ? { [ENTITY_ID_VENUS]: venusPosition } : {}),
        }
      : undefined;

  const calloutEntry = CALLOUT_SCRIPT.find((entry) => entry.tick === tick);
  const calloutEvents: CalloutEvent[] = calloutEntry
    ? [{ type: 'callout', calloutId: ORACLE_CALLOUT_ID, value: calloutEntry.value }]
    : [];

  const world = step(state.world, grid, { moveOrders });
  const mechanics = stepMechanics(config, state.mechanics, world, calloutEvents, TICK_SECONDS);

  return { world, mechanics, tick, rally: state.rally };
}
