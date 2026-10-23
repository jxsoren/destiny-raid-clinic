import { describe, expect, it } from 'vitest';
import type { World } from '../../src/engine';
import type { PlateConfig } from '../../src/mechanics/plateHold';
import { initPlateState, stepPlate } from '../../src/mechanics/plateHold';

const plate: PlateConfig = { id: 'mars-plate', position: { x: 50, y: 50 }, radius: 10 };

function worldWithEntityAt(x: number, y: number): World {
  return {
    tick: 0,
    entities: [{ id: 'bot-1', position: { x, y }, path: [], speed: 0 }],
    rng: () => 0,
  };
}

describe('initPlateState', () => {
  it('starts unheld', () => {
    expect(initPlateState()).toEqual({ held: false, heldBy: null });
  });
});

describe('stepPlate', () => {
  it('is held when an entity stands within the radius', () => {
    const world = worldWithEntityAt(52, 50);
    expect(stepPlate(plate, world)).toEqual({ held: true, heldBy: 'bot-1' });
  });

  it('is held exactly at the radius boundary', () => {
    const world = worldWithEntityAt(60, 50);
    expect(stepPlate(plate, world)).toEqual({ held: true, heldBy: 'bot-1' });
  });

  it('is not held when every entity is outside the radius', () => {
    const world = worldWithEntityAt(90, 90);
    expect(stepPlate(plate, world)).toEqual({ held: false, heldBy: null });
  });

  it('is not held when there are no entities at all', () => {
    const world: World = { tick: 0, entities: [], rng: () => 0 };
    expect(stepPlate(plate, world)).toEqual({ held: false, heldBy: null });
  });

  it('picks the first qualifying entity by world entity order when more than one stands on the plate', () => {
    const world: World = {
      tick: 0,
      entities: [
        { id: 'bot-1', position: { x: 51, y: 50 }, path: [], speed: 0 },
        { id: 'bot-2', position: { x: 49, y: 50 }, path: [], speed: 0 },
      ],
      rng: () => 0,
    };
    expect(stepPlate(plate, world)).toEqual({ held: true, heldBy: 'bot-1' });
  });
});
