import { defineConfig } from 'vitest/config';

// @raid-clinic/ui/space's barrel re-exports a Solid component (SpaceScene.tsx) alongside the plain
// createRng/hashSeed helpers this package actually uses. This package never renders it, but Vite
// still has to parse/transform that file as part of resolving the '@raid-clinic/ui/space' import,
// and the repo's shared tsconfig sets `jsx: "preserve"` (for Astro), which esbuild can't evaluate
// as JS. Force esbuild's own JSX transform here so that parse succeeds.
export default defineConfig({
  oxc: {
    jsx: { runtime: 'automatic' },
  },
  test: {
    environment: 'node',
    globals: true,
  },
});
