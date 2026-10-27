import { expect, test } from '@playwright/test';

test('raid scene shows the real encounter and a route to its trainer', async ({ page }) => {
  await page.goto('/raids/vault-of-glass/');
  await expect(page.getByRole('heading', { name: 'Vault of Glass', exact: true })).toBeVisible();
  await expect(page.locator('.raid-director__space .rc-planet')).toHaveCount(1);
  await expect(page.getByRole('list')).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: "Atheon, Time's Conflux: Playable" }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Launch trainer', exact: true }).click();
  await expect(page).toHaveURL('/raids/vault-of-glass/atheon/trainer/');
});

test('E launches the selected trainer and browser back restores the raid route', async ({
  page,
}) => {
  await page.goto('/raids/vault-of-glass/');
  await expect(page.getByRole('region', { name: 'Selected encounter' })).toBeVisible();
  await expect(async () => {
    await page.keyboard.press('e');
    await expect(page).toHaveURL('/raids/vault-of-glass/atheon/trainer/', { timeout: 500 });
  }).toPass({ timeout: 15_000 });
  await page.goBack();
  await expect(page).toHaveURL('/raids/vault-of-glass/');
});

test('empty raids show an honest empty state and a working return link', async ({ page }) => {
  await page.goto('/raids/kings-fall/');
  await expect(
    page.getByText('No encounters are available for this raid yet.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole('list')).toHaveCount(0);
  await page.getByRole('link', { name: 'Back to raids' }).click();
  await expect(page).toHaveURL('/');
});

test('Escape on a raid page goes back to the Director', async ({ page }) => {
  await page.goto('/raids/vault-of-glass/');
  await expect(page.getByRole('heading', { name: /Vault of Glass/ }).first()).toBeVisible();
  // The island hydrates after load; keep pressing until its listener is installed.
  await expect(async () => {
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL('/', { timeout: 500 });
  }).toPass({ timeout: 15_000 });
});

test.describe('responsive raid layout', () => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 320, height: 568 },
    { width: 1280, height: 720 },
    { width: 844, height: 390 },
  ]) {
    test(`launch remains reachable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/raids/vault-of-glass/');
      const launch = page.getByRole('button', { name: 'Launch trainer', exact: true });
      await launch.scrollIntoViewIfNeeded();
      const [button, footer] = await Promise.all([
        launch.boundingBox(),
        page.locator('.raid-director__footer').boundingBox(),
      ]);
      if (!button || !footer) throw new Error('Missing launch or footer geometry');
      expect(button.y + button.height).toBeLessThanOrEqual(footer.y);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        viewport.width,
      );
      await launch.click();
      await expect(page).toHaveURL('/raids/vault-of-glass/atheon/trainer/');
    });
  }
});

test('raid screen remains usable without GPU rendering and with reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
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
  await page.goto('/raids/vault-of-glass/');
  const scene = page.locator('.raid-director__space .rc-space');
  await expect(scene).toHaveClass(/rc-space--fallback/, { timeout: 30_000 });
  await expect(scene).toHaveAttribute('data-motion', 'off');
  await expect(page.locator('.rc-planet__orb')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Launch trainer', exact: true })).toBeVisible();
  // The decorative planet must not add a focusable planet button to keyboard navigation.
  await page.getByRole('link', { name: 'Back to raids' }).focus();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: "Atheon, Time's Conflux: Playable" }),
  ).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(
    page.getByRole('button', { name: "Atheon, Time's Conflux: Playable" }),
  ).toHaveAttribute('aria-pressed', 'true');
});
