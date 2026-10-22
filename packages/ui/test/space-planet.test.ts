// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createPlanet } from '../src/space/shaders/planet';
import { type PlanetSpec, SURFACES } from '../src/space/types';

const SPEC: PlanetSpec = {
  surface: 'venus',
  tint: '#d9b46a', // lint-allow-color
  atmosphere: '#ffd690', // lint-allow-color
  ring: false,
  size: 1,
  position: [0.5, 0.5],
  location: 'Venus',
  tagline: 'Guardians make their own fate.',
};

describe('createPlanet', () => {
  it.each(SURFACES)('builds a %s planet: glow, sphere and halo', (surface) => {
    const v = createPlanet({ ...SPEC, surface }, { featured: false, octaves: 3, seed: 1 });
    expect(v.group.children).toHaveLength(3);
    v.update(1, 0.1);
    v.setDim(true);
    v.dispose();
  });

  it('adds a ring and the featured dashed halo', () => {
    const v = createPlanet({ ...SPEC, ring: true }, { featured: true, octaves: 3, seed: 2 });
    expect(v.group.children).toHaveLength(5);
    v.dispose();
  });
});
