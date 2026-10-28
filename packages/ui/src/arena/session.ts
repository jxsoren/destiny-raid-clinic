// The live, player-driven session for Atheon's trainer — replaces scenario.ts's fixed timeline for
// an interactive playthrough. scenario.ts itself is untouched; it keeps powering the pre-role-pick
// idle demo. See docs/superpowers/specs/2026-10-27-atheon-movement-camera-foundation-design.md.
import type {
  CalloutEvent,
  EncounterMechanicsConfig,
  MechanicsState,
  NavGrid,
  PlateConfig,
  Point,
  World,
} from '@raid-clinic/sim';
import { createMechanicsState, createWorld, step, stepMechanics, TICK_HZ } from '@raid-clinic/sim';

/** Seconds per engine tick. */
export const SESSION_TICK_SECONDS = 1 / TICK_HZ;
/** Sim units per second both the player and plate-bots move — matches scenario.ts's own ENTITY_SPEED. */
const ENTITY_SPEED = 60;
/** The player's entity id in the world. */
export const PLAYER_ENTITY_ID = 'player';
/** Only 'plate' is actually selectable in this sub-project — see the design spec's scope decision 4.
 * 'caller' has no input mechanism until 4c ships the chat overlay; the type stays general so
 * enabling it later is a small follow-on change, not a rewrite. */
export type PlayerRole = 'plate' | 'caller';
/** The plate a 'plate'-role player holds, chosen arbitrarily (matching the scripted demo's original
 * single-entity target) — see the design spec's "Plate coverage" note. */
const PLAYER_PLATE_ID = 'mars-plate';
/** The callout mechanic's id in Atheon's real content — this module is specific to that content. */
const ORACLE_CALLOUT_ID = 'oracle-order';

export interface SessionState {
  world: World;
  mechanics: MechanicsState;
  playerRole: PlayerRole;
  /** Whether the one-time plate-bot move orders have already been issued. */
  ordersIssued: boolean;
}

/** The plates a placeholder bot must cover: every plate when the player plays 'caller' (not yet
 * selectable), or every plate except `PLAYER_PLATE_ID` when the player plays 'plate'. */
function platesForBots(config: EncounterMechanicsConfig, playerRole: PlayerRole): PlateConfig[] {
  if (playerRole === 'caller') return config.plates;
  return config.plates.filter((plate) => plate.id !== PLAYER_PLATE_ID);
}

/** Builds a fresh live session: a `player` entity at `rally`, plus one placeholder-bot entity per
 * plate the player isn't personally holding. */
export function createSessionState(
  config: EncounterMechanicsConfig,
  rally: Point,
  playerRole: PlayerRole,
): SessionState {
  const player = { id: PLAYER_ENTITY_ID, position: { ...rally }, path: [], speed: ENTITY_SPEED };
  const botPlates = platesForBots(config, playerRole);
  const bots = botPlates.map((_, index) => ({
    id: `plate-bot-${index}`,
    position: { ...rally },
    path: [],
    speed: ENTITY_SPEED,
  }));

  return {
    world: createWorld([player, ...bots], 1),
    mechanics: createMechanicsState(config),
    playerRole,
    ordersIssued: false,
  };
}

/** The placeholder Caller's callout events: while the oracle-order mechanic is `'pending'`, submit
 * the exact next value it's already waiting for. The full sequence is known, non-hidden content
 * data — no "watch the Oracles light up" logic is needed, see the design spec's correction note on
 * why an earlier draft's "watch for newly-lit markers" approach was circular in this sim. */
function placeholderCalloutEvents(
  config: EncounterMechanicsConfig,
  mechanics: MechanicsState,
): CalloutEvent[] {
  const calloutConfig = config.callouts.find((callout) => callout.id === ORACLE_CALLOUT_ID);
  const calloutState = mechanics.callouts[ORACLE_CALLOUT_ID];
  if (!calloutConfig || !calloutState || calloutState.status !== 'pending') return [];
  const value = calloutConfig.sequence[calloutState.nextIndex];
  return value ? [{ type: 'callout', calloutId: ORACLE_CALLOUT_ID, value }] : [];
}

/**
 * Advances the session by one tick: the player is steered by `playerInput` (a zero vector if no
 * keys are held); each plate-bot is issued its one-time `moveOrders` destination exactly once,
 * tracked via `state.ordersIssued` (a structural invariant of the session's own state, rather than
 * inferred from the engine's `World.tick`) and never re-issued; the placeholder callout logic runs
 * only when the player plays `'plate'` (when `'caller'` becomes playable in 4c, the player submits
 * their own callouts instead, so this is skipped).
 */
export function stepSession(
  grid: NavGrid,
  config: EncounterMechanicsConfig,
  state: SessionState,
  playerInput: { dx: number; dy: number },
): SessionState {
  const botPlates = platesForBots(config, state.playerRole);
  const moveOrders: Record<string, Point> | undefined =
    !state.ordersIssued && botPlates.length > 0
      ? Object.fromEntries(botPlates.map((plate, index) => [`plate-bot-${index}`, plate.position]))
      : undefined;

  const world = step(state.world, grid, {
    moveOrders,
    moveDirect: { [PLAYER_ENTITY_ID]: playerInput },
  });

  const calloutEvents =
    state.playerRole === 'plate' ? placeholderCalloutEvents(config, state.mechanics) : [];
  const mechanics = stepMechanics(
    config,
    state.mechanics,
    world,
    calloutEvents,
    SESSION_TICK_SECONDS,
  );

  return {
    world,
    mechanics,
    playerRole: state.playerRole,
    ordersIssued: state.ordersIssued || moveOrders !== undefined,
  };
}
