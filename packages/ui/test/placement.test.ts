import { overlapArea, placeTooltip, type Rect } from '../src/placement';

const viewport = { w: 1200, h: 700 };
const tip = { w: 260, h: 150 };
const boxOf = (p: { x: number; y: number }): Rect => ({ x: p.x, y: p.y, w: tip.w, h: tip.h });

describe('overlapArea', () => {
  it('is zero for separate rects and the shared area otherwise', () => {
    expect(overlapArea({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 0, w: 10, h: 10 })).toBe(0);
    expect(overlapArea({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(25);
  });
});

describe('placeTooltip', () => {
  it('prefers the right side when there is room', () => {
    const target = { x: 300, y: 300, w: 100, h: 100 };
    const p = placeTooltip(target, tip, viewport);
    expect(p.side).toBe('right');
    expect(p.x).toBe(412);
    expect(overlapArea(boxOf(p), target)).toBe(0);
  });

  it('flips left near the right edge', () => {
    const target = { x: 1050, y: 300, w: 100, h: 100 };
    const p = placeTooltip(target, tip, viewport);
    expect(p.side).toBe('left');
    expect(overlapArea(boxOf(p), target)).toBe(0);
  });

  it('moves away from rects it must avoid', () => {
    const target = { x: 300, y: 300, w: 100, h: 100 };
    const planetOnRight = { x: 430, y: 280, w: 140, h: 140 };
    const p = placeTooltip(target, tip, viewport, [planetOnRight]);
    expect(p.side).not.toBe('right');
    expect(overlapArea(boxOf(p), planetOnRight)).toBe(0);
    expect(overlapArea(boxOf(p), target)).toBe(0);
  });

  it('always stays inside the viewport', () => {
    const target = { x: 0, y: 0, w: 40, h: 40 };
    const p = placeTooltip(target, tip, viewport);
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.x + tip.w).toBeLessThanOrEqual(viewport.w);
    expect(p.y + tip.h).toBeLessThanOrEqual(viewport.h);
  });
});
