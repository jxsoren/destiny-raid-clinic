// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createBackground } from '../src/space/shaders/background';
import { createConstruction } from '../src/space/shaders/construction';
import { disposeObject } from '../src/space/shaders/geometry';
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

  it('builds construction lines: crosshair, two circles, two diamonds', () => {
    const g = createConstruction(16 / 9);
    expect(g.children).toHaveLength(5);
    disposeObject(g);
  });
});
