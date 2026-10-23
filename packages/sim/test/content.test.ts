import { describe, expect, it } from 'vitest';
import { toMechanicsConfig } from '../src/content';
import type { EncounterMechanicsContent } from '../src/content';

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
