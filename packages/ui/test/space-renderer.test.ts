// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScenePlanet } from '../src/space/types';

const calls = vi.hoisted(() => ({ create: 0, dispose: 0, setDim: [] as boolean[] }));

vi.mock('three/webgpu', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three/webgpu')>();
  class FakeRenderer {
    backend = { isWebGPUBackend: true, device: {} };
    domElement = { dataset: {} };
    init = async () => {};
    setPixelRatio() {}
    setSize() {}
    setAnimationLoop() {}
    render() {}
    dispose() {}
  }
  return { ...actual, WebGPURenderer: FakeRenderer };
});

vi.mock('../src/space/shaders/planet', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/space/shaders/planet')>();
  const { Group } = await import('three/webgpu');
  return {
    ...actual,
    createPlanet: () => {
      calls.create += 1;
      return {
        group: new Group(),
        update: () => {},
        setDim: (d: boolean) => calls.setDim.push(d),
        dispose: () => {
          calls.dispose += 1;
        },
      };
    },
  };
});

import { SpaceRenderer } from '../src/space/SpaceRenderer';

const planet = (id: string, over: Partial<ScenePlanet['planet']> = {}): ScenePlanet => ({
  id,
  name: id,
  status: [],
  planet: {
    surface: 'ice',
    tint: 'tint-a',
    atmosphere: 'glow-a',
    ring: false,
    size: 1,
    position: [0.5, 0.5],
    location: 'Europa',
    tagline: 'cold',
    ...over,
  },
});

async function make() {
  const r = await SpaceRenderer.create({} as HTMLCanvasElement, {
    seed: 1,
    quality: { octaves: 2, stars: 5, brightStars: 1, maxDpr: 1, parallax: false } as never,
    reducedMotion: true,
  });
  r.resize(800, 400, 1);
  return r;
}

describe('SpaceRenderer.setPlanets diffing', () => {
  beforeEach(() => {
    calls.create = 0;
    calls.dispose = 0;
    calls.setDim = [];
  });

  it('does not recreate unchanged planets', async () => {
    const r = await make();
    r.setPlanets([planet('a')]);
    r.setPlanets([planet('a')]);
    expect(calls.create).toBe(1);
  });

  it('updates dim without recreating', async () => {
    const r = await make();
    r.setPlanets([planet('a')]);
    r.setPlanets([{ ...planet('a'), dimmed: true }]);
    expect(calls.create).toBe(1);
    expect(calls.setDim.at(-1)).toBe(true);
  });

  it('does not recreate on position, tagline or location changes', async () => {
    const r = await make();
    r.setPlanets([planet('a')]);
    r.setPlanets([planet('a', { position: [0.2, 0.3], tagline: 'x', location: 'y' })]);
    expect(calls.create).toBe(1);
  });

  it('recreates when the tint changes', async () => {
    const r = await make();
    r.setPlanets([planet('a')]);
    r.setPlanets([planet('a', { tint: 'tint-b' })]);
    expect(calls.create).toBe(2);
    expect(calls.dispose).toBe(1);
  });

  it('disposes removed planets', async () => {
    const r = await make();
    r.setPlanets([planet('a'), planet('b')]);
    r.setPlanets([planet('a')]);
    expect(calls.dispose).toBe(1);
  });
});
