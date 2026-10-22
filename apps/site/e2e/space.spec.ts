import { expect, test } from '@playwright/test';

const LIVE = '[data-testid="space-live"] .rc-space';
const STATIC = '[data-testid="space-fallback"] .rc-space';

test('the live space scene draws frames without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/styleguide/');
  const scene = page.locator(LIVE);
  await scene.scrollIntoViewIfNeeded();
  await expect(scene).toHaveClass(/rc-space--live/, { timeout: 30_000 });
  await expect(scene.locator('.rc-planet')).toHaveCount(9);
  await expect
    .poll(async () => Number((await scene.locator('canvas').getAttribute('data-frames')) ?? 0), {
      timeout: 60_000, // the first frame compiles every shader; slow under software GL on CI
    })
    .toBeGreaterThanOrEqual(1);
  // The DOM overlay follows the renderer: live planets get pixel positions from its frames.
  const overlay = () =>
    scene.evaluate((root) => {
      const planet = root.querySelector<HTMLElement>('.rc-planet');
      const canvas = root.querySelector('canvas');
      return {
        left: planet?.style.left ?? '',
        style: planet?.getAttribute('style') ?? '',
        classes: planet?.className ?? '',
        backend: root.getAttribute('data-backend'),
        frames: canvas?.dataset.frames,
        canvas: canvas ? `${canvas.width}x${canvas.height}` : null,
        box: `${root.clientWidth}x${root.clientHeight}`,
      };
    });
  let seen = await overlay();
  for (const deadline = Date.now() + 15_000; !seen.left.endsWith('px') && Date.now() < deadline; ) {
    await page.waitForTimeout(250);
    seen = await overlay();
  }
  expect(seen.left, `overlay never got pixel positions: ${JSON.stringify(seen)}`).toMatch(/px$/);
  expect(errors).toEqual([]);
});

test('the static scene shows every planet with its label', async ({ page }) => {
  await page.goto('/styleguide/');
  const scene = page.locator(STATIC);
  await expect(scene).toHaveClass(/rc-space--fallback/);
  await expect(scene.locator('.rc-planet__orb')).toHaveCount(9);
  await expect(scene.getByText('Gas giant', { exact: true })).toBeVisible();
});

test('without WebGPU or WebGL the live scene falls back to CSS planets', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true });
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      if (/webgl|webgpu/.test(type)) return null;
      return (original as (...args: unknown[]) => unknown).call(this, type, ...rest);
    } as typeof original;
  });
  await page.goto('/styleguide/');
  const scene = page.locator(LIVE);
  await expect(scene).toHaveClass(/rc-space--fallback/, { timeout: 30_000 });
  await expect(scene.locator('.rc-planet__orb')).toHaveCount(9);
});

test('reduced motion keeps the scene but turns motion off', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/styleguide/');
  const scene = page.locator(LIVE);
  await expect(scene).toHaveAttribute('data-motion', 'off');
  await expect(scene).toHaveClass(/rc-space--live/, { timeout: 30_000 });
});
