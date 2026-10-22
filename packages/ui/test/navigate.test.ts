import { describe, expect, it } from 'vitest';
import { nearestInDirection } from '../src/space/navigate';
import type { PlanetScreen } from '../src/space/types';

const at = (id: string, x: number, y: number): PlanetScreen => ({
  id,
  x,
  y,
  r: 10,
  labelX: x + 20,
  labelY: y,
});
// a . b
// . c .
// d . e
const SCREENS = [
  at('a', 0, 0),
  at('b', 200, 0),
  at('c', 100, 100),
  at('d', 0, 200),
  at('e', 200, 200),
];

describe('nearestInDirection', () => {
  it('moves to the nearest planet in the pressed direction', () => {
    expect(nearestInDirection(SCREENS, 'a', [1, 0])).toBe('b');
    expect(nearestInDirection(SCREENS, 'a', [0, 1])).toBe('d');
    expect(nearestInDirection(SCREENS, 'c', [-1, 0])).toBe('a');
    expect(nearestInDirection(SCREENS, 'e', [0, -1])).toBe('b');
  });

  it('prefers planets close to the axis over closer diagonal ones', () => {
    const screens = [at('o', 0, 0), at('diag', 60, 55), at('axis', 120, 5)];
    expect(nearestInDirection(screens, 'o', [1, 0])).toBe('axis');
  });

  it('stays put at an edge and starts from the first planet when nothing is selected', () => {
    expect(nearestInDirection(SCREENS, 'b', [1, 0])).toBe('b');
    expect(nearestInDirection(SCREENS, null, [1, 0])).toBe('a');
    expect(nearestInDirection([], null, [1, 0])).toBeNull();
  });
});
