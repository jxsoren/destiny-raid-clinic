// Single source of truth for every color/light constant ArenaRenderer.ts uses. Per
// docs/superpowers/specs/2026-10-23-atheon-polish-elevation-design.md's "training clarity over
// mood" decision: plain MeshStandardMaterial colors tuned for legibility first, mood second — no
// custom ShaderMaterial, no PMREMGenerator environment map, no FogExp2.
import type { MechanicsState, SequenceCalloutConfig, SequenceCalloutState } from '@raid-clinic/sim';

/** Ground color per level/band height, in ascending height order — brighter toward higher
 * elevation so elevation always reads visually, independent of lighting. Keyed by the exact height
 * values `arena.levels`/`arena.hallBands` produce in content today. */
const LEVEL_COLORS: Record<number, number> = {
  [-2.5]: 0x2e333d,
  0: 0x3a4049,
  0.5: 0x454b55,
  1: 0x4f5560,
  1.5: 0x5a616d,
  2: 0x666d7a,
};
const LEVEL_COLOR_DEFAULT = 0x3a4049;

/** Ground color for a level/band at the given height. Falls back to the main-floor color (height
 * 0's) for any height not in the known palette — a content/palette mismatch, not expected in
 * normal operation, but should still render something reasonable rather than throw. */
export function levelColor(height: number): number {
  return LEVEL_COLORS[height] ?? LEVEL_COLOR_DEFAULT;
}

export const WALL_COLOR = 0x6c7380;
export const OBSTACLE_COLOR = 0x1c2026;
export const STAIR_COLOR = 0x50566a;

export const SCENE_BACKGROUND_COLOR = 0x12151c;
export const SUN_COLOR = 0xcbd6e8;
export const HEMISPHERE_SKY_COLOR = 0xffffff;
export const HEMISPHERE_GROUND_COLOR = 0x444444;
export const FOG_COLOR = SCENE_BACKGROUND_COLOR;

export const GROUND_WIPE_COLOR = 0x5a2626;
export const GROUND_WIN_COLOR = 0x2d5a2d;

export const PLATE_UNLIT_COLOR = 0x2a2a2a;
export const PLATE_LIT_COLORS: Record<string, number> = {
  'mars-plate': 0xe0704f,
  'venus-plate': 0xb6c95a,
};
export const MARKER_UNLIT_COLOR = 0x444444;
export const MARKER_LIT_COLOR = 0xffffff;
export const ENTITY_COLOR = 0x8ad0ff;

/** A plate's disc color for its current held state. Warns (and falls back to white) on an id with
 * no configured lit color — a content/renderer mismatch, not expected in normal operation. */
export function plateColor(plateId: string, held: boolean): number {
  if (!held) return PLATE_UNLIT_COLOR;
  const lit = PLATE_LIT_COLORS[plateId];
  if (lit === undefined) {
    console.warn(`No lit color configured for plate "${plateId}"; falling back to white.`);
    return 0xffffff;
  }
  return lit;
}

/** The ids of `calloutConfig`'s sequence values already correctly called, per `calloutState`. */
export function litMarkerIds(
  calloutConfig: SequenceCalloutConfig | undefined,
  calloutState: SequenceCalloutState | undefined,
): Set<string> {
  if (!calloutConfig || !calloutState) return new Set();
  return new Set(calloutConfig.sequence.slice(0, calloutState.nextIndex));
}

/** The ground tint override for the scenario's current outcome: wiped (red) or a post-success win
 * window (green). Returns `null` when neither applies — the caller should fall back to each ground
 * mesh's own per-level `levelColor`, since there's no longer a single uniform ground color now that
 * elevation gives each level/band a distinct base color. */
export function groundColor(mechanics: MechanicsState, inWinWindow: boolean): number | null {
  if (mechanics.wiped) return GROUND_WIPE_COLOR;
  if (inWinWindow) return GROUND_WIN_COLOR;
  return null;
}
