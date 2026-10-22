/** How much scene a device gets (spec §4: 60fps on a mid-range laptop, degrade on phones). */
export interface Quality {
  tier: 'high' | 'low';
  stars: number;
  brightStars: number;
  /** fbm octaves in the nebula and planet shaders. */
  octaves: number;
  /** Cap on devicePixelRatio. */
  maxDpr: number;
  parallax: boolean;
}

export function pickQuality(env: {
  coarsePointer: boolean;
  width: number;
  cores: number;
  reducedMotion: boolean;
}): Quality {
  const low = env.coarsePointer || env.width < 760 || env.cores <= 4;
  return {
    tier: low ? 'low' : 'high',
    stars: low ? 500 : 1200,
    brightStars: low ? 6 : 10,
    octaves: low ? 3 : 5,
    maxDpr: low ? 1.5 : 2,
    parallax: !low && !env.reducedMotion,
  };
}
