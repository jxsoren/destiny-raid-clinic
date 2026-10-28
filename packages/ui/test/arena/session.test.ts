import type { EncounterMechanicsConfig } from '@raid-clinic/sim';
import { buildNavGrid } from '@raid-clinic/sim';
import { describe, expect, it } from 'vitest';
import { createSessionState, PLAYER_ENTITY_ID, stepSession } from '../../src/arena/session';

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

const twoPlateConfig: EncounterMechanicsConfig = {
  plates: [
    { id: 'mars-plate', position: { x: 50, y: 50 }, radius: 10 },
    { id: 'venus-plate', position: { x: 80, y: 80 }, radius: 10 },
  ],
  callouts: [{ id: 'oracle-order', sequence: ['oracle-2', 'oracle-5', 'oracle-1'] }],
  wipeConditions: [
    { id: 'mars-plate-check', type: 'plateMustBeHeld', plateId: 'mars-plate', graceSeconds: 7 },
    { id: 'venus-plate-check', type: 'plateMustBeHeld', plateId: 'venus-plate', graceSeconds: 7 },
    { id: 'oracle-order-check', type: 'calloutMustSucceed', calloutId: 'oracle-order' },
  ],
};

function run(ticks: number, playerInput: { dx: number; dy: number } = { dx: 0, dy: 0 }) {
  let state = createSessionState(twoPlateConfig, rally, 'plate');
  for (let i = 0; i < ticks; i++) state = stepSession(grid, twoPlateConfig, state, playerInput);
  return state;
}

describe('createSessionState', () => {
  it('starts the player entity at rally', () => {
    const state = createSessionState(twoPlateConfig, rally, 'plate');
    const player = state.world.entities.find((e) => e.id === PLAYER_ENTITY_ID);
    expect(player?.position).toEqual(rally);
  });

  it('spawns one bot entity per plate the player is not personally holding', () => {
    const state = createSessionState(twoPlateConfig, rally, 'plate');
    // Player holds mars-plate; a bot should cover venus-plate (the only "other" plate).
    expect(state.world.entities).toHaveLength(2);
  });

  it('spawns a bot for every plate when the player plays caller (not yet selectable in the UI, but the logic must stay correct)', () => {
    const state = createSessionState(twoPlateConfig, rally, 'caller');
    expect(state.world.entities).toHaveLength(1 + twoPlateConfig.plates.length);
  });
});

describe('stepSession', () => {
  it("moves the player by playerInput, respecting the engine's wall-sliding collision", () => {
    const state = run(1, { dx: 1, dy: 0 });
    const player = state.world.entities.find((e) => e.id === PLAYER_ENTITY_ID);
    expect(player?.position.x).toBeGreaterThan(rally.x);
  });

  it("the venus-plate bot reaches and holds its plate, satisfying venus's wipe condition", () => {
    const state = run(200);
    expect(state.mechanics.plates['venus-plate']?.held).toBe(true);
  });

  it('emits the placeholder callout sequence and resolves it correct, when player plays plate', () => {
    const state = run(10);
    expect(state.mechanics.callouts['oracle-order']?.status).toBe('correct');
  });

  it('never wipes on the oracle-order condition when the player plays plate (the placeholder resolves it immediately)', () => {
    const state = run(60);
    expect(state.mechanics.wiped).toBe(false);
  });
});
