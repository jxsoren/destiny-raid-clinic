// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createBackground } from '../src/space/shaders/background';
import { createConstruction } from '../src/space/shaders/construction';
import { createStars } from '../src/space/shaders/stars';
import { generateStars } from '../src/space/stars';

describe('space shader builders', () => {
  it('builds the background without a GPU', () => {
    const bg = createBackground(7, 3);
    expect(bg.mesh.material).toBeDefined();
    bg.setAspect(16 / 9);
    bg.setFrame(0, 0, 16 / 9, 1);
    bg.setTime(1);
    bg.setOffset(0.001, 0);
    bg.dispose();
  });

  it('builds a twinkling star layer and a flared one', () => {
    const plain = createStars(generateStars(1, 20, [1, 2]), false);
    expect(plain.sprite.count).toBe(20);
    plain.setAspect(1.5);
    plain.setTime(2);
    plain.dispose();
    const flared = createStars(generateStars(2, 4, [9, 15]), true);
    expect(flared.sprite.count).toBe(4);
    flared.dispose();
  });

  it('builds construction lines once and only moves aspect-dependent parts', () => {
    const c = createConstruction();
    const count = c.group.children.length;
    expect(count).toBe(6);
    const diamonds = c.group.children.filter((o) => o.userData.side !== undefined);
    expect(diamonds).toHaveLength(2);
    c.setAspect(2);
    expect(c.group.children).toHaveLength(count);
    const xs = diamonds.map((d) => d.position.x).sort((x, y) => x - y);
    expect(xs[0]).toBeCloseTo(-1.93);
    expect(xs[1]).toBeCloseTo(1.93);
    c.dispose();
  });
});
