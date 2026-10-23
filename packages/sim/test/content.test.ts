import { describe, expect, it } from 'vitest';
import type { EncounterArenaContent, EncounterMechanicsContent } from '../src/content';
import { toArenaDef, toMechanicsConfig } from '../src/content';

describe('toMechanicsConfig', () => {
  it('maps plateHold and sequenceCallout mechanics entries plus wipe conditions', () => {
    const content: EncounterMechanicsContent = {
      mechanics: [
        { id: 'mars-plate', type: 'plateHold', position: { x: 50, y: 50 }, radius: 10 },
        { id: 'oracle-order', type: 'sequenceCallout', sequence: ['left', 'right'] },
      ],
      wipe_conditions: [
        { id: 'mars-plate-check', type: 'plateMustBeHeld', plateId: 'mars-plate', graceSeconds: 7 },
        { id: 'oracle-order-check', type: 'calloutMustSucceed', calloutId: 'oracle-order' },
      ],
    };

    expect(toMechanicsConfig(content)).toEqual({
      plates: [{ id: 'mars-plate', position: { x: 50, y: 50 }, radius: 10 }],
      callouts: [{ id: 'oracle-order', sequence: ['left', 'right'] }],
      wipeConditions: content.wipe_conditions,
    });
  });

  it('maps an empty content object to empty config arrays', () => {
    expect(toMechanicsConfig({ mechanics: [], wipe_conditions: [] })).toEqual({
      plates: [],
      callouts: [],
      wipeConditions: [],
    });
  });

  it('throws on an unrecognized mechanics entry type', () => {
    const content = {
      mechanics: [{ id: 'bad', type: 'unknownType' }],
      wipe_conditions: [],
    } as unknown as EncounterMechanicsContent;

    expect(() => toMechanicsConfig(content)).toThrow(
      'Unrecognized mechanics entry type: unknownType',
    );
  });
});

describe('toArenaDef', () => {
  it('maps an encounter arena field to an ArenaDef', () => {
    const content: EncounterArenaContent = {
      arena: {
        width: 100,
        height: 80,
        walkable: [
          [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 80 },
            { x: 0, y: 80 },
          ],
        ],
        obstacles: [
          [
            { x: 40, y: 30 },
            { x: 60, y: 30 },
            { x: 60, y: 50 },
            { x: 40, y: 50 },
          ],
        ],
        walls: [
          [
            { x: 0, y: 40 },
            { x: 20, y: 40 },
          ],
        ],
      },
    };

    expect(toArenaDef(content)).toEqual({
      width: 100,
      height: 80,
      walkable: content.arena.walkable,
      obstacles: content.arena.obstacles,
      walls: content.arena.walls,
    });
  });
});
