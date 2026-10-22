// Director geometry shared by the renderer and the CSS fallback. The camera is orthographic and the
// Director spans y ∈ [-1, 1], so at the home view a normalized position (px, py) lands at (px·W, py·H).
import type { PlanetScreen, PlanetSpec, View } from './types';

/** Planet radius at size 1.0, in world units. */
export const BASE_RADIUS = 0.1;
/** The featured raid is drawn this much larger. */
export const FEATURED_SCALE = 1.35;
/** Halo circle and the featured dashed circle, as multiples of the radius. */
export const HALO = 1.42;
export const FEATURED_HALO = 1.75;
/** Outer edge of a planet ring, as a multiple of the radius. */
export const RING_OUTER = 2.1;
/** Gap between the cleared planet edge and its label, in CSS pixels (space.css uses the same 10px). */
export const LABEL_GAP = 10;

export const HOME_VIEW: View = { cx: 0, cy: 0, zoom: 1 };

export function worldPosition(position: [number, number], aspect: number): [number, number] {
  return [(position[0] * 2 - 1) * aspect, 1 - position[1] * 2];
}

export function worldRadius(planet: Pick<PlanetSpec, 'size'>, featured = false): number {
  return BASE_RADIUS * planet.size * (featured ? FEATURED_SCALE : 1);
}

/** World point to CSS pixels for the orthographic camera framed by `view` on a w×h canvas. */
export function toScreen(
  wx: number,
  wy: number,
  view: View,
  w: number,
  h: number,
): [number, number] {
  const halfH = 1 / view.zoom;
  const halfW = w / h / view.zoom;
  return [((wx - view.cx) / halfW / 2 + 0.5) * w, (0.5 - (wy - view.cy) / halfH / 2) * h];
}

export function screenRadius(r: number, view: View, h: number): number {
  return r * view.zoom * 0.5 * h;
}

/** How far from the center a label sits to clear the halo, or the ring (multiple of the radius). */
export function labelClearance(ring: boolean): number {
  return ring ? RING_OUTER + 0.1 : HALO + 0.08;
}

export function planetScreen(
  p: { id: string; planet: Pick<PlanetSpec, 'position' | 'size' | 'ring'>; featured?: boolean },
  view: View,
  w: number,
  h: number,
): PlanetScreen {
  const [wx, wy] = worldPosition(p.planet.position, w / h);
  const [x, y] = toScreen(wx, wy, view, w, h);
  const r = screenRadius(worldRadius(p.planet, p.featured), view, h);
  return {
    id: p.id,
    x,
    y,
    r,
    labelX: x + r * labelClearance(p.planet.ring) + LABEL_GAP,
    labelY: y,
  };
}

export function offsetScreen(s: PlanetScreen, dx: number, dy: number): PlanetScreen {
  return { ...s, x: s.x + dx, y: s.y + dy, labelX: s.labelX + dx, labelY: s.labelY + dy };
}

/** True when the lists differ in ids or any position or radius moved more than `epsilon` pixels. */
export function screensDiffer(a: PlanetScreen[], b: PlanetScreen[], epsilon: number): boolean {
  if (a.length !== b.length) return true;
  return a.some((s, i) => {
    const o = b[i];
    return (
      s.id !== o.id ||
      Math.abs(s.x - o.x) > epsilon ||
      Math.abs(s.y - o.y) > epsilon ||
      Math.abs(s.r - o.r) > epsilon
    );
  });
}

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/** Camera framing `t` (0 to 1) of the way from `a` to `b`, eased out (spec §3.4: about 600ms). */
export function tweenView(a: View, b: View, t: number): View {
  const k = easeOutCubic(Math.min(1, Math.max(0, t)));
  return {
    cx: a.cx + (b.cx - a.cx) * k,
    cy: a.cy + (b.cy - a.cy) * k,
    zoom: a.zoom + (b.zoom - a.zoom) * k,
  };
}
