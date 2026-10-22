import { describe, expect, it } from 'vitest';
import {
  BASE_RADIUS,
  FEATURED_SCALE,
  HALO,
  HOME_VIEW,
  LABEL_GAP,
  labelClearance,
  offsetScreen,
  planetScreen,
  RING_OUTER,
  screensDiffer,
  toScreen,
  tweenView,
  worldPosition,
  worldRadius,
} from '../src/space/layout';

describe('space layout', () => {
  it('maps normalized positions to world space with y up', () => {
    expect(worldPosition([0.5, 0.5], 16 / 9)).toEqual([0, 0]);
    expect(worldPosition([0, 0], 2)).toEqual([-2, 1]);
    expect(worldPosition([1, 1], 2)).toEqual([2, -1]);
  });

  it('maps world back to CSS pixels at the home view, the same place as the CSS fallback', () => {
    const [wx, wy] = worldPosition([0.25, 0.75], 1600 / 900);
    const [x, y] = toScreen(wx, wy, HOME_VIEW, 1600, 900);
    expect(x).toBeCloseTo(400);
    expect(y).toBeCloseTo(675);
  });

  it('zooms around the view center', () => {
    const [x, y] = toScreen(0.5, 0.25, { cx: 0.5, cy: 0.25, zoom: 3 }, 1000, 500);
    expect(x).toBeCloseTo(500);
    expect(y).toBeCloseTo(250);
    // halfW = (1000 / 500) / 2 = 1 world unit, so 0.1 world is 5% of the width
    const [x2] = toScreen(0.6, 0.25, { cx: 0.5, cy: 0.25, zoom: 2 }, 1000, 500);
    expect(x2).toBeCloseTo(550);
  });

  it('sizes planets by size and featured', () => {
    expect(worldRadius({ size: 1 })).toBe(BASE_RADIUS);
    expect(worldRadius({ size: 1.5 }, true)).toBeCloseTo(BASE_RADIUS * 1.5 * FEATURED_SCALE);
  });

  it('places labels clear of the halo, or of the ring when there is one', () => {
    expect(labelClearance(false)).toBeGreaterThan(HALO);
    expect(labelClearance(true)).toBeGreaterThan(RING_OUTER);
    const s = planetScreen(
      { id: 'a', planet: { position: [0.5, 0.5], size: 1, ring: false } },
      HOME_VIEW,
      1000,
      1000,
    );
    expect(s.r).toBeCloseTo(BASE_RADIUS * 500);
    expect(s.labelX).toBeCloseTo(500 + s.r * labelClearance(false) + LABEL_GAP);
    expect(s.labelY).toBeCloseTo(500);
  });

  it('eases views from a to b and clamps t', () => {
    const a = { cx: 0, cy: 0, zoom: 1 };
    const b = { cx: 1, cy: -1, zoom: 3 };
    expect(tweenView(a, b, 0)).toEqual(a);
    expect(tweenView(a, b, 1)).toEqual(b);
    expect(tweenView(a, b, 2)).toEqual(b);
    expect(tweenView(a, b, 0.5).cx).toBeGreaterThan(0.5); // ease-out is past halfway at t = 0.5
  });

  it('offsets screens and reports only real changes', () => {
    const s = { id: 'a', x: 10, y: 20, r: 5, labelX: 30, labelY: 20 };
    expect(offsetScreen(s, 2, -3)).toEqual({ id: 'a', x: 12, y: 17, r: 5, labelX: 32, labelY: 17 });
    expect(screensDiffer([s], [s], 0.25)).toBe(false);
    expect(screensDiffer([s], [{ ...s, x: 10.1 }], 0.25)).toBe(false);
    expect(screensDiffer([s], [{ ...s, x: 11 }], 0.25)).toBe(true);
    expect(screensDiffer([s], [{ ...s, id: 'b' }], 0.25)).toBe(true);
    expect(screensDiffer([s], [], 0.25)).toBe(true);
  });
});
