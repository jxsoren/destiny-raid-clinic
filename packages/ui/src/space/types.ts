import type { Availability } from '../StatusIcon';

/** Planet surface types. Must match `SURFACES` in crates/raidlint/src/rules.rs (scripts/space-sync.test.mjs checks). */
export const SURFACES = [
  'venus',
  'gas',
  'ice',
  'moon',
  'lush',
  'lush-dark',
  'violet',
  'pale',
  'desert',
] as const;
export type Surface = (typeof SURFACES)[number];

/** The `planet` block of raid.json (validated by raidlint). */
export interface PlanetSpec {
  surface: Surface;
  /** Hex color of the surface. */
  tint: string;
  /** Hex color of the atmosphere rim and glow. */
  atmosphere: string;
  ring: boolean;
  /** Relative to the base radius, 0.5 to 1.6. */
  size: number;
  /** Normalized Director position, origin top-left, each axis 0 to 1. */
  position: [number, number];
  location: string;
  tagline: string;
}

/** One planet in a scene: a raid (Director) or a demo body (/styleguide). */
export interface ScenePlanet {
  id: string;
  name: string;
  planet: PlanetSpec;
  status: Availability[];
  /** Drawn larger, with the dashed halo. */
  featured?: boolean;
  /** Nothing playable: darker and desaturated. */
  dimmed?: boolean;
}

/** Where a planet is on screen, in CSS pixels from the scene's top-left corner. */
export interface PlanetScreen {
  id: string;
  x: number;
  y: number;
  r: number;
  labelX: number;
  labelY: number;
}

/** Camera framing: world center and zoom (1 shows the whole Director). */
export interface View {
  cx: number;
  cy: number;
  zoom: number;
}
