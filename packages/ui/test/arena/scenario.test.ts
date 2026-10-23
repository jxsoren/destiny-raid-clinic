import { buildNavGrid } from '@raid-clinic/sim';
import type { EncounterMechanicsConfig } from '@raid-clinic/sim';
import { describe, expect, it } from 'vitest';
import { createScenarioState, stepScenario } from '../../src/arena/scenario';

const config: EncounterMechanicsConfig = {
  plates: [{ id: 'mars-plate', position: { x: 50, y: 50 }, radius: 10 }],
  callouts: [{ id: 'oracle-order', sequence: ['oracle-2', 'oracle-5', 'oracle-1'] }],
  wipeConditions: [
    { id: 'mars-plate-check', type: 'plateMustBeHeld', plateId: 'mars-plate', graceSeconds: 7 },
    { id: 'oracle-order-check', type: 'calloutMustSucceed', calloutId: 'oracle-order' },
  ],
};

const arena = {
  width: 100,
  height: 100,
  walkable: [
    [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ],
  ],
  obstacles: [],
  walls: [],
};
const grid = buildNavGrid(arena, 5);
const rally = { x: 10, y: 10 };

function run(ticks: number) {
  let state = createScenarioState(config, rally);
  for (let i = 0; i < ticks; i++) state = stepScenario(grid, config, state);
  return state;
}

describe('createScenarioState', () => {
  it('starts the entity at rally with fresh mechanics state', () => {
    const state = createScenarioState(config, rally);
    expect(state.world.entities).toEqual([
      { id: 'bot', position: { x: 10, y: 10 }, path: [], speed: 60 },
    ]);
    expect(state.mechanics.wiped).toBe(false);
    expect(state.tick).toBe(0);
  });
});

describe('stepScenario', () => {
  it('issues a move order toward the Mars plate on the first tick', () => {
    const state = stepScenario(grid, config, createScenarioState(config, rally));
    expect(state.world.entities[0].path.length).toBeGreaterThan(0);
  });

  it('walks onto the plate and runs the scripted Oracle-order callouts to a correct resolution', () => {
    const state = run(10 * 30);
    expect(state.mechanics.plates['mars-plate'].held).toBe(true);
    expect(state.mechanics.callouts['oracle-order']).toEqual({ status: 'correct', nextIndex: 3 });
    expect(state.mechanics.wiped).toBe(false);
  });

  it('resets back to the start after LOOP_SECONDS', () => {
    const state = run(16 * 30);
    expect(state.tick).toBe(0);
    expect(state.world.entities[0].position).toEqual({ x: 10, y: 10 });
    expect(state.mechanics.callouts['oracle-order']).toEqual({ status: 'pending', nextIndex: 0 });
  });
});
