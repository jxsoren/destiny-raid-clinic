import { describe, expect, it } from 'vitest';
import { pickQuality } from '../src/space/quality';
import { generateStars } from '../src/space/stars';

describe('pickQuality', () => {
  const desktop = { coarsePointer: false, width: 1440, cores: 8, reducedMotion: false };

  it('gives desktops the full scene', () => {
    expect(pickQuality(desktop)).toEqual({
      tier: 'high',
      stars: 1200,
      brightStars: 10,
      octaves: 5,
      maxDpr: 2,
      parallax: true,
    });
  });

  it('degrades on phones, small screens and weak CPUs', () => {
    for (const env of [
      { ...desktop, coarsePointer: true },
      { ...desktop, width: 600 },
      { ...desktop, cores: 4 },
    ]) {
      const q = pickQuality(env);
      expect(q.tier).toBe('low');
      expect(q.stars).toBeLessThan(1200);
      expect(q.octaves).toBeLessThan(5);
      expect(q.parallax).toBe(false);
    }
  });

  it('turns parallax off for reduced motion', () => {
    expect(pickQuality({ ...desktop, reducedMotion: true }).parallax).toBe(false);
  });
});

describe('generateStars', () => {
  it('is deterministic per seed', () => {
    expect(generateStars(7, 50, [1, 2])).toEqual(generateStars(7, 50, [1, 2]));
    expect(generateStars(7, 50, [1, 2]).positions).not.toEqual(
      generateStars(8, 50, [1, 2]).positions,
    );
  });

  it('fills the screen square with sized, tinted, phased stars', () => {
    const f = generateStars(3, 400, [0.8, 3]);
    expect(f.count).toBe(400);
    expect(f.positions).toHaveLength(800);
    expect(f.sizes).toHaveLength(400);
    expect(f.tints).toHaveLength(1200);
    expect(f.phases).toHaveLength(400);
    for (const v of f.positions) {
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThan(1);
    }
    for (const s of f.sizes) {
      expect(s).toBeGreaterThanOrEqual(0.8);
      expect(s).toBeLessThanOrEqual(3);
    }
  });
});
