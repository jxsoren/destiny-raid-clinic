import type {
  EncounterMechanicsConfig,
  PlateConfig,
  SequenceCalloutConfig,
  WipeCondition,
} from './mechanics';

/** A `mechanics` array entry for encounter.json, discriminated on `type`. */
export type MechanicContentEntry =
  | ({ type: 'plateHold' } & PlateConfig)
  | ({ type: 'sequenceCallout' } & SequenceCalloutConfig);

/** The shape of encounter.json's `mechanics`/`wipe_conditions` fields, already `JSON.parse`d. */
export interface EncounterMechanicsContent {
  mechanics: MechanicContentEntry[];
  wipe_conditions: WipeCondition[];
}

/**
 * Builds the `EncounterMechanicsConfig` that `createMechanicsState`/`stepMechanics` expect from an
 * encounter.json's `mechanics`/`wipe_conditions` arrays. Does no file I/O — the caller reads and
 * `JSON.parse`s the file first.
 * @param content - the encounter's parsed `mechanics`/`wipe_conditions` fields
 * @returns the equivalent `EncounterMechanicsConfig`
 * @throws if a `mechanics` entry's `type` isn't `'plateHold'` or `'sequenceCallout'` — that's a
 * content bug (encounter.json doesn't match the schema), not a runtime state to handle gracefully.
 */
export function toMechanicsConfig(content: EncounterMechanicsContent): EncounterMechanicsConfig {
  const plates: PlateConfig[] = [];
  const callouts: SequenceCalloutConfig[] = [];

  for (const entry of content.mechanics) {
    switch (entry.type) {
      case 'plateHold': {
        const { type: _type, ...plate } = entry;
        plates.push(plate);
        break;
      }
      case 'sequenceCallout': {
        const { type: _type, ...callout } = entry;
        callouts.push(callout);
        break;
      }
      default: {
        const unexpected: never = entry;
        throw new Error(
          `Unrecognized mechanics entry type: ${(unexpected as { type: string }).type}`,
        );
      }
    }
  }

  return { plates, callouts, wipeConditions: content.wipe_conditions };
}
