// Noise helpers built on MaterialX noise (deterministic: no time or random input unless passed in).
import { abs, float, mx_fractal_noise_float, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';

/** fbm remapped to roughly 0..1. */
export function fbm(p: Node<'vec3'>, octaves = 5): Node<'float'> {
  return mx_fractal_noise_float(p, octaves, 2, 0.5).mul(0.5).add(0.5);
}

/** Ridged noise: sharp crests where the noise crosses zero (cracks, veins). */
export function ridged(p: Node<'vec3'>, octaves = 4): Node<'float'> {
  return float(1).sub(abs(mx_fractal_noise_float(p, octaves, 2, 0.5)));
}

/** Domain warp: offsets p by a noise field, for turbulent bands and swirls. */
export function warp(p: Node<'vec3'>, amount: number, octaves = 3): Node<'vec3'> {
  const q = vec3(
    fbm(p.add(vec3(1.7, 9.2, 0)), octaves),
    fbm(p.add(vec3(8.3, 2.8, 4.1)), octaves),
    fbm(p.add(vec3(5.2, 1.3, 7.7)), octaves),
  );
  return p.add(q.sub(0.5).mul(amount));
}
