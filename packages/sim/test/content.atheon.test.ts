import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { toMechanicsConfig, toArenaDef } from '../src/content';
import type { EncounterMechanicsContent, EncounterArenaContent } from '../src/content';
import type { World } from '../src/engine';
import { createMechanicsState, stepMechanics } from '../src/mechanics';
import { buildNavGrid } from '../src/navgrid';
import { findPath } from '../src/pathfinding';
import { distance } from '../src/geometry';

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

// Atheon's real Oracle-order mechanic randomizes its 3-of-6 sequence at runtime, once per set.
// encounter.json's `oracle-order` entry stores one representative sequence instead (as if called
// for a specific drill/replay) — `SequenceCalloutConfig.sequence` is fixed at author time, so it
// can't model runtime randomization. The Aegis relic-cleanse, Void meter, Imminent Detain, and
// time-gate room sequencing mechanics are real parts of the encounter but aren't represented here
// at all: none of them fit plate-hold/sequence-callout/wipe-conditions, the only primitives this
// content wiring pass covers.
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

const arenaDef = toArenaDef(encounter as unknown as EncounterArenaContent);
const grid = buildNavGrid(arenaDef, 5);

// This covers only 2D pathfinding geometry (walkable regions, obstacles, walls). Atheon's real
// stairs/multi-level height data is deliberately not in `arena.stairs`/`arena.levels` yet — the
// prototype's own 2D pathfinding never consults height, so it's a pure rendering concern, deferred
// to the scene-shell sub-project where it first becomes visually relevant.
describe('Atheon encounter.json arena geometry', () => {
  it('routes around a real obstacle instead of straight through it', () => {
    const from = { x: 150, y: 580 };
    const to = { x: 300, y: 580 };
    const path = findPath(grid, from, to);

    expect(path.length).toBeGreaterThan(0);

    let totalLength = 0;
    let previous = from;
    for (const point of path) {
      totalLength += distance(previous, point);
      previous = point;
    }

    const straightLineDistance = distance(from, to);
    expect(straightLineDistance).toBe(150);
    expect(totalLength).toBeGreaterThan(straightLineDistance);
  });
});
