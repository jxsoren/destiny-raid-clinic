import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { toMechanicsConfig } from '../src/content';
import type { EncounterMechanicsContent } from '../src/content';
import type { World } from '../src/engine';
import { createMechanicsState, stepMechanics } from '../src/mechanics';

const encounterPath = fileURLToPath(
  new URL(
    '../../../content/raids/vault-of-glass/encounters/07-atheon/encounter.json',
    import.meta.url,
  ),
);
const encounter = JSON.parse(readFileSync(encounterPath, 'utf8')) as EncounterMechanicsContent;
const config = toMechanicsConfig(encounter);

function worldWithEntityAt(x: number, y: number): World {
  return {
    tick: 0,
    entities: [{ id: 'bot-1', position: { x, y }, path: [], speed: 0 }],
    rng: () => 0,
  };
}

describe('Atheon encounter.json mechanics content', () => {
  it('configures both sync plates and the Oracle-order callout, not wiped', () => {
    const state = createMechanicsState(config);
    expect(state.plates['mars-plate']).toEqual({ held: false, heldBy: null });
    expect(state.plates['venus-plate']).toEqual({ held: false, heldBy: null });
    expect(state.callouts['oracle-order']).toEqual({ status: 'pending', nextIndex: 0 });
    expect(state.wiped).toBe(false);
  });

  it('holds the Mars plate when an entity stands on it', () => {
    let state = createMechanicsState(config);
    state = stepMechanics(config, state, worldWithEntityAt(201.5, 860), [], 1);
    expect(state.plates['mars-plate']).toEqual({ held: true, heldBy: 'bot-1' });
    expect(state.plates['venus-plate']).toEqual({ held: false, heldBy: null });
  });

  it('advances the Oracle-order callout through its representative sequence', () => {
    let state = createMechanicsState(config);
    for (const value of ['oracle-2', 'oracle-5', 'oracle-1']) {
      state = stepMechanics(
        config,
        state,
        worldWithEntityAt(201.5, 860),
        [{ type: 'callout', calloutId: 'oracle-order', value }],
        1,
      );
    }
    expect(state.callouts['oracle-order']).toEqual({ status: 'correct', nextIndex: 3 });
    expect(state.wiped).toBe(false);
  });

  it('wipes once a plate has been unheld for its configured grace period', () => {
    const state = createMechanicsState(config);
    const result = stepMechanics(config, state, worldWithEntityAt(0, 0), [], 7);
    expect(result.wiped).toBe(true);
    expect(result.wipeReason).toBe('mars-plate-check');
  });

  it('wipes when the Oracle-order callout fails', () => {
    let state = createMechanicsState(config);
    state = stepMechanics(
      config,
      state,
      worldWithEntityAt(201.5, 860),
      [{ type: 'callout', calloutId: 'oracle-order', value: 'oracle-6' }],
      1,
    );
    expect(state.wiped).toBe(true);
    expect(state.wipeReason).toBe('oracle-order-check');
  });
});
