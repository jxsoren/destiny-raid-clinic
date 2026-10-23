import type { Point } from './geometry';
import type {
  EncounterMechanicsConfig,
  PlateConfig,
  SequenceCalloutConfig,
  WipeCondition,
} from './mechanics';
import type { ArenaDef } from './navgrid';

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

/** The shape of encounter.json's `arena` field that pathfinding needs, already `JSON.parse`d. */
export interface EncounterArenaContent {
  arena: {
    width: number;
    height: number;
    walkable: Point[][];
    obstacles: Point[][];
    walls: Array<[Point, Point]>;
  };
}

/**
 * Builds the `ArenaDef` that `buildNavGrid` expects from an encounter.json's `arena` field. Does
 * no file I/O — the caller reads and `JSON.parse`s the file first. A direct field-for-field copy —
 * `ArenaDef`'s shape already matches encounter.json's `arena` fields exactly — kept as its own
 * named function so a future schema divergence between encounter.json's `arena` and `ArenaDef` has
 * one place to absorb it.
 * @param content - the encounter's parsed `arena` field
 * @returns the equivalent `ArenaDef`
 */
export function toArenaDef(content: EncounterArenaContent): ArenaDef {
  const { width, height, walkable, obstacles, walls } = content.arena;
  return { width, height, walkable, obstacles, walls };
}
