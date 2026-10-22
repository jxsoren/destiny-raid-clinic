// Renderer-only colors. The style lint allows literals in shaders/ folders.
// VOID and BEAM must equal --void and --glow in tokens.css (scripts/space-sync.test.mjs checks).

export const VOID = '#040507';
export const BEAM = '#dff4ef';
export const LINE = '#ffffff';

/** Nebula washes: low-intensity teal, violet, amber and blue (spec §4). */
export const NEBULA = {
  teal: '#1c6b73',
  violet: '#4a2b70',
  amber: '#7a4c1e',
  blue: '#1e3d80',
} as const;

/** Star tints as linear RGB; mostly white with some blue-white and warm stars. */
export const STAR_TINTS: readonly (readonly [number, number, number])[] = [
  [1, 1, 1],
  [1, 1, 1],
  [0.82, 0.9, 1],
  [1, 0.92, 0.8],
  [0.78, 0.86, 1],
];

/** One shared sun at the top left, slightly toward the camera (normalized). */
export const SUN_DIRECTION: readonly [number, number, number] = [-0.5513, 0.6515, 0.5212];

/** Cloud white, the pale-planet base and the lush ocean shift. */
export const CLOUD_WHITE: readonly [number, number, number] = [0.95, 0.95, 0.96];
export const PALE_BASE: readonly [number, number, number] = [0.94, 0.93, 0.96];
export const OCEAN_SHIFT: readonly [number, number, number] = [0.45, 0.75, 1.5];
