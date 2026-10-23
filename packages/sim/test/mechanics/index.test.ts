import { describe, expect, it } from 'vitest';
import { createMechanicsState, stepMechanics } from '../../src/mechanics/index';
import type { EncounterMechanicsConfig } from '../../src/mechanics/index';
import type { World } from '../../src/engine';

const config: EncounterMechanicsConfig = {
  plates: [{ id: 'mars-plate', position: { x: 50, y: 50 }, radius: 10 }],
  callouts: [{ id: 'oracle-order', sequence: ['left', 'right'] }],
  wipeConditions: [
    { id: 'mars-plate-check', type: 'plateMustBeHeld', plateId: 'mars-plate', graceSeconds: 7 },
    { id: 'oracle-order-check', type: 'calloutMustSucceed', calloutId: 'oracle-order' },
  ],
};

function worldWithEntityAt(x: number, y: number): World {
  return {
    tick: 0,
    entities: [{ id: 'bot-1', position: { x, y }, path: [], speed: 0 }],
    rng: () => 0,
  };
}

describe('createMechanicsState', () => {
  it('initializes every configured plate and callout, not wiped', () => {
    const state = createMechanicsState(config);
    expect(state.plates['mars-plate']).toEqual({ held: false, heldBy: null });
    expect(state.callouts['oracle-order']).toEqual({ status: 'pending', nextIndex: 0 });
    expect(state.wiped).toBe(false);
    expect(state.wipeReason).toBeNull();
  });
});

describe('stepMechanics', () => {
  it('updates plate and callout states together from one call', () => {
    let state = createMechanicsState(config);
    state = stepMechanics(
      config,
      state,
      worldWithEntityAt(50, 50),
      [{ type: 'callout', calloutId: 'oracle-order', value: 'left' }],
      1,
    );
    expect(state.plates['mars-plate']).toEqual({ held: true, heldBy: 'bot-1' });
    expect(state.callouts['oracle-order']).toEqual({ status: 'pending', nextIndex: 1 });
    expect(state.wiped).toBe(false);
  });

  it('wipes via a configured wipe condition and then freezes all further updates', () => {
    let state = createMechanicsState(config);
    // Fail the callout outright.
    state = stepMechanics(
      config,
      state,
      worldWithEntityAt(999, 999),
      [{ type: 'callout', calloutId: 'oracle-order', value: 'right' }],
      1,
    );
    expect(state.wiped).toBe(true);
    expect(state.wipeReason).toBe('oracle-order-check');

    const frozen = state;
    state = stepMechanics(
      config,
      state,
      worldWithEntityAt(50, 50),
      [{ type: 'callout', calloutId: 'oracle-order', value: 'left' }],
      1,
    );
    expect(state).toEqual(frozen);
  });
});
