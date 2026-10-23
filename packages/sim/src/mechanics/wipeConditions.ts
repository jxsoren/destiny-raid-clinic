import type { PlateState } from './plateHold';
import type { SequenceCalloutState } from './sequenceCallout';

/** Per-condition elapsed-unheld timers, keyed by `WipeCondition.id`. */
export interface WipeTimerState {
  elapsedUnheld: Record<string, number>;
}

export function initWipeTimerState(): WipeTimerState {
  return { elapsedUnheld: {} };
}

/** Wipes if `plateId` isn't continuously held for `graceSeconds`; the unheld timer resets to 0 whenever the plate is held. */
export interface PlateMustBeHeldCondition {
  id: string;
  type: 'plateMustBeHeld';
  plateId: string;
  graceSeconds: number;
}

/** Wipes immediately once `calloutId`'s sequence-callout mechanic resolves to `'failed'`. */
export interface CalloutMustSucceedCondition {
  id: string;
  type: 'calloutMustSucceed';
  calloutId: string;
}

export type WipeCondition = PlateMustBeHeldCondition | CalloutMustSucceedCondition;

export interface WipeEvaluationInput {
  plateStates: Record<string, PlateState>;
  calloutStates: Record<string, SequenceCalloutState>;
  /** Seconds elapsed this tick, for accumulating grace-period timers. */
  dt: number;
}

export interface WipeEvaluationResult {
  timerState: WipeTimerState;
  wiped: boolean;
  /** The id of the condition that triggered the wipe, or null if no wipe occurred. */
  reason: string | null;
}

/**
 * Checks `conditions` in order, stopping at the first one that triggers a wipe. Conditions after
 * a triggering one are not evaluated this tick (their timers are left unchanged).
 * @param conditions - the wipe conditions to check, in priority order
 * @param timerState - grace-period timers from the previous tick
 * @param input - this tick's plate/callout states and elapsed time
 * @returns the updated timer state, whether a wipe occurred, and which condition caused it
 */
export function evaluateWipeConditions(
  conditions: WipeCondition[],
  timerState: WipeTimerState,
  input: WipeEvaluationInput,
): WipeEvaluationResult {
  const elapsedUnheld = { ...timerState.elapsedUnheld };

  for (const condition of conditions) {
    if (condition.type === 'plateMustBeHeld') {
      const plate = input.plateStates[condition.plateId];
      elapsedUnheld[condition.id] = plate?.held ? 0 : (elapsedUnheld[condition.id] ?? 0) + input.dt;
      if (elapsedUnheld[condition.id] >= condition.graceSeconds) {
        return { timerState: { elapsedUnheld }, wiped: true, reason: condition.id };
      }
    } else {
      const callout = input.calloutStates[condition.calloutId];
      if (callout?.status === 'failed') {
        return { timerState: { elapsedUnheld }, wiped: true, reason: condition.id };
      }
    }
  }

  return { timerState: { elapsedUnheld }, wiped: false, reason: null };
}
