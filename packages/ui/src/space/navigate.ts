import type { PlanetScreen } from './types';

/**
 * Arrow-key selection on a space screen (spec §5.1): the nearest planet in the pressed
 * direction, preferring planets near the axis. `dir` is a screen-space unit vector (y down).
 * Returns the current id when nothing lies that way, or the first planet when none is selected.
 */
export function nearestInDirection(
  screens: PlanetScreen[],
  fromId: string | null,
  dir: [number, number],
): string | null {
  const from = screens.find((s) => s.id === fromId);
  if (!from) return screens[0]?.id ?? null;
  let best = from.id;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const s of screens) {
    if (s.id === from.id) continue;
    const dx = s.x - from.x;
    const dy = s.y - from.y;
    const along = dx * dir[0] + dy * dir[1];
    if (along <= 0) continue;
    const across = Math.abs(dx * dir[1] - dy * dir[0]);
    const score = along + across * 2;
    if (score < bestScore) {
      bestScore = score;
      best = s.id;
    }
  }
  return best;
}
