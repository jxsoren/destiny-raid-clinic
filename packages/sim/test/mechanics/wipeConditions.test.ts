import { describe, expect, it } from 'vitest';
import { evaluateWipeConditions, initWipeTimerState } from '../../src/mechanics/wipeConditions';
import type { WipeCondition } from '../../src/mechanics/wipeConditions';

describe('initWipeTimerState', () => {
  it('starts with no elapsed time tracked', () => {
    expect(initWipeTimerState()).toEqual({ elapsedUnheld: {} });
  });
});

describe('evaluateWipeConditions', () => {
  const plateCondition: WipeCondition = {
    id: 'mars-plate-check',
    type: 'plateMustBeHeld',
    plateId: 'mars-plate',
    graceSeconds: 7,
  };
  const calloutCondition: WipeCondition = {
    id: 'oracle-order-check',
    type: 'calloutMustSucceed',
    calloutId: 'oracle-order',
  };

  it('does not wipe while the plate is held', () => {
    const result = evaluateWipeConditions([plateCondition], initWipeTimerState(), {
      plateStates: { 'mars-plate': { held: true, heldBy: 'bot-1' } },
      calloutStates: {},
      dt: 1,
    });
    expect(result.wiped).toBe(false);
    expect(result.timerState.elapsedUnheld['mars-plate-check']).toBe(0);
  });

  it('accumulates unheld time across ticks without wiping before the grace period', () => {
    let timerState = initWipeTimerState();
    for (let i = 0; i < 6; i++) {
      const result = evaluateWipeConditions([plateCondition], timerState, {
        plateStates: { 'mars-plate': { held: false, heldBy: null } },
        calloutStates: {},
        dt: 1,
      });
      expect(result.wiped).toBe(false);
      timerState = result.timerState;
    }
    expect(timerState.elapsedUnheld['mars-plate-check']).toBe(6);
  });

  it('wipes once the plate has been unheld for the full grace period', () => {
    let timerState = initWipeTimerState();
    let result = evaluateWipeConditions([plateCondition], timerState, {
      plateStates: { 'mars-plate': { held: false, heldBy: null } },
      calloutStates: {},
      dt: 7,
    });
    expect(result.wiped).toBe(true);
    expect(result.reason).toBe('mars-plate-check');
  });

  it('resets the unheld timer once the plate is held again', () => {
    let timerState = initWipeTimerState();
    let result = evaluateWipeConditions([plateCondition], timerState, {
      plateStates: { 'mars-plate': { held: false, heldBy: null } },
      calloutStates: {},
      dt: 3,
    });
    timerState = result.timerState;
    result = evaluateWipeConditions([plateCondition], timerState, {
      plateStates: { 'mars-plate': { held: true, heldBy: 'bot-1' } },
      calloutStates: {},
      dt: 1,
    });
    expect(result.wiped).toBe(false);
    expect(result.timerState.elapsedUnheld['mars-plate-check']).toBe(0);
  });

  it('wipes immediately when a required callout has failed', () => {
    const result = evaluateWipeConditions([calloutCondition], initWipeTimerState(), {
      plateStates: {},
      calloutStates: { 'oracle-order': { status: 'failed', nextIndex: 1 } },
      dt: 1,
    });
    expect(result.wiped).toBe(true);
    expect(result.reason).toBe('oracle-order-check');
  });

  it('does not wipe when the callout is still pending or already correct', () => {
    const pendingResult = evaluateWipeConditions([calloutCondition], initWipeTimerState(), {
      plateStates: {},
      calloutStates: { 'oracle-order': { status: 'pending', nextIndex: 1 } },
      dt: 1,
    });
    expect(pendingResult.wiped).toBe(false);

    const correctResult = evaluateWipeConditions([calloutCondition], initWipeTimerState(), {
      plateStates: {},
      calloutStates: { 'oracle-order': { status: 'correct', nextIndex: 3 } },
      dt: 1,
    });
    expect(correctResult.wiped).toBe(false);
  });

  it('checks conditions in order and stops at the first wipe, leaving later conditions unevaluated', () => {
    const result = evaluateWipeConditions(
      [calloutCondition, plateCondition],
      initWipeTimerState(),
      {
        plateStates: { 'mars-plate': { held: false, heldBy: null } },
        calloutStates: { 'oracle-order': { status: 'failed', nextIndex: 1 } },
        dt: 100,
      },
    );
    expect(result.wiped).toBe(true);
    expect(result.reason).toBe('oracle-order-check');
    expect(result.timerState.elapsedUnheld['mars-plate-check']).toBeUndefined();
  });
});
