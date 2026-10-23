import type { World } from '../engine';
import type { PlateConfig, PlateState } from './plateHold';
import { initPlateState, stepPlate } from './plateHold';
import type { CalloutEvent, SequenceCalloutConfig, SequenceCalloutState } from './sequenceCallout';
import { initSequenceCalloutState, stepSequenceCallout } from './sequenceCallout';
import type { WipeCondition, WipeTimerState } from './wipeConditions';
import { evaluateWipeConditions, initWipeTimerState } from './wipeConditions';

/** Every mechanic an encounter configures: its plates, callouts, and the wipe conditions that read them. */
export interface EncounterMechanicsConfig {
  plates: PlateConfig[];
  callouts: SequenceCalloutConfig[];
  wipeConditions: WipeCondition[];
}

export interface MechanicsState {
  plates: Record<string, PlateState>;
  callouts: Record<string, SequenceCalloutState>;
  wipeTimer: WipeTimerState;
  wiped: boolean;
  wipeReason: string | null;
}

/** Builds the starting state for every mechanic in `config`. */
export function createMechanicsState(config: EncounterMechanicsConfig): MechanicsState {
  const plates: Record<string, PlateState> = {};
  for (const plate of config.plates) plates[plate.id] = initPlateState();

  const callouts: Record<string, SequenceCalloutState> = {};
  for (const callout of config.callouts) callouts[callout.id] = initSequenceCalloutState();

  return { plates, callouts, wipeTimer: initWipeTimerState(), wiped: false, wipeReason: null };
}

/**
 * Advances every configured mechanic by one tick, in a fixed order: plates, then callouts, then
 * wipe conditions (which read the results of the first two). Once `wiped` is true, state is
 * frozen — this function returns `state` unchanged on every subsequent call.
 * @param config - the encounter's configured mechanics
 * @param state - the mechanics state before this tick
 * @param world - the current world, for reading entity positions (plate checks)
 * @param calloutEvents - this tick's callout events from any source
 * @param dt - seconds elapsed this tick, for wipe-condition grace-period timers
 * @returns this tick's resulting mechanics state
 */
export function stepMechanics(
  config: EncounterMechanicsConfig,
  state: MechanicsState,
  world: World,
  calloutEvents: CalloutEvent[],
  dt: number,
): MechanicsState {
  if (state.wiped) return state;

  const plates: Record<string, PlateState> = {};
  for (const plateConfig of config.plates) {
    plates[plateConfig.id] = stepPlate(plateConfig, world);
  }

  const callouts: Record<string, SequenceCalloutState> = {};
  for (const calloutConfig of config.callouts) {
    callouts[calloutConfig.id] = stepSequenceCallout(
      calloutConfig,
      state.callouts[calloutConfig.id],
      calloutEvents,
    );
  }

  const evaluation = evaluateWipeConditions(config.wipeConditions, state.wipeTimer, {
    plateStates: plates,
    calloutStates: callouts,
    dt,
  });

  return {
    plates,
    callouts,
    wipeTimer: evaluation.timerState,
    wiped: evaluation.wiped,
    wipeReason: evaluation.reason,
  };
}

export type {
  CalloutEvent,
  PlateConfig,
  PlateState,
  SequenceCalloutConfig,
  SequenceCalloutState,
  WipeCondition,
  WipeTimerState,
};
