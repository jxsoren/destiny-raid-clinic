// Tooltip placement: try right, left, bottom, top; keep inside the viewport; never cover the
// target; avoid other rects (e.g. planets). Pure so it can be unit-tested.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Size {
  w: number;
  h: number;
}
export type Side = 'right' | 'left' | 'bottom' | 'top';
export interface Placement {
  x: number;
  y: number;
  side: Side;
}

const GAP = 12;
const SIDES: Side[] = ['right', 'left', 'bottom', 'top'];

export function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

function candidate(side: Side, t: Rect, tip: Size): Placement {
  if (side === 'right') return { side, x: t.x + t.w + GAP, y: t.y + t.h / 2 - tip.h / 2 };
  if (side === 'left') return { side, x: t.x - GAP - tip.w, y: t.y + t.h / 2 - tip.h / 2 };
  if (side === 'bottom') return { side, x: t.x + t.w / 2 - tip.w / 2, y: t.y + t.h + GAP };
  return { side, x: t.x + t.w / 2 - tip.w / 2, y: t.y - GAP - tip.h };
}

function clampInto(p: Placement, tip: Size, viewport: Size): Placement {
  return {
    side: p.side,
    x: Math.min(Math.max(p.x, 0), Math.max(0, viewport.w - tip.w)),
    y: Math.min(Math.max(p.y, 0), Math.max(0, viewport.h - tip.h)),
  };
}

export function placeTooltip(
  target: Rect,
  tip: Size,
  viewport: Size,
  avoid: Rect[] = [],
): Placement {
  let best = clampInto(candidate('right', target, tip), tip, viewport);
  let bestCost = Number.POSITIVE_INFINITY;
  for (const side of SIDES) {
    const raw = candidate(side, target, tip);
    const p = clampInto(raw, tip, viewport);
    const box = { x: p.x, y: p.y, w: tip.w, h: tip.h };
    const cost =
      overlapArea(box, target) * 10 +
      avoid.reduce((sum, r) => sum + overlapArea(box, r), 0) +
      Math.abs(raw.x - p.x) +
      Math.abs(raw.y - p.y);
    if (cost === 0) return p;
    if (cost < bestCost) {
      best = p;
      bestCost = cost;
    }
  }
  return best;
}
