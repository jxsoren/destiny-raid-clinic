import { createRng as createRngPublic, hashSeed as hashSeedPublic } from '@raid-clinic/ui/space';
import { describe, expect, it } from 'vitest';
import { createRng, hashSeed } from '../src/space/rng';

describe('createRng', () => {
  it('repeats the same sequence for the same seed and stays in [0, 1)', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('differs between seeds', () => {
    expect(createRng(1)()).not.toBe(createRng(2)());
  });
});

describe('hashSeed', () => {
  it('is a stable unsigned integer per id', () => {
    expect(hashSeed('vault-of-glass')).toBe(hashSeed('vault-of-glass'));
    expect(hashSeed('a')).not.toBe(hashSeed('b'));
    expect(Number.isInteger(hashSeed('x'))).toBe(true);
    expect(hashSeed('x')).toBeGreaterThanOrEqual(0);
  });
});

describe('public export', () => {
  it('createRng and hashSeed are importable from the package root', () => {
    expect(typeof createRngPublic).toBe('function');
    expect(typeof hashSeedPublic).toBe('function');
    expect(createRngPublic(hashSeedPublic('atheon'))()).toBeGreaterThanOrEqual(0);
  });
});
