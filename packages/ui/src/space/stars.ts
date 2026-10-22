import { createRng } from './rng';
import { STAR_TINTS } from './shaders/palette';

/** Per-star attributes for an instanced sprite layer. Positions are in [-1, 1) screen-square units. */
export interface StarField {
  count: number;
  /** x, y pairs. */
  positions: Float32Array;
  /** Diameter in CSS pixels. */
  sizes: Float32Array;
  /** r, g, b triples. */
  tints: Float32Array;
  /** Twinkle phase in radians. */
  phases: Float32Array;
}

export function generateStars(seed: number, count: number, sizeRange: [number, number]): StarField {
  const rand = createRng(seed);
  const [min, max] = sizeRange;
  const positions = new Float32Array(count * 2);
  const sizes = new Float32Array(count);
  const tints = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 2] = rand() * 2 - 1;
    positions[i * 2 + 1] = rand() * 2 - 1;
    const s = rand();
    sizes[i] = min + s * s * (max - min); // squared: many small stars, few big ones
    tints.set(STAR_TINTS[Math.floor(rand() * STAR_TINTS.length)], i * 3);
    phases[i] = rand() * Math.PI * 2;
  }
  return { count, positions, sizes, tints, phases };
}
