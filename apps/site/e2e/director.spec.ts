import { expect, test } from '@playwright/test';

const SCENE = '.director .rc-space';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator(`${SCENE} .rc-planet`)).toHaveCount(14);
  // The tooltip only renders once the island has hydrated, so keys sent next are not lost.
  await expect(page.getByRole('tooltip')).toBeVisible();
});

test('shows every raid, with the featured playable raid selected and described', async ({
  page,
}) => {
  const vog = page.getByRole('button', { name: /^Vault of Glass, Venus/ });
  await expect(vog).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('[data-planet="vault-of-glass"] .rc-planet__brackets')).toHaveCount(1);
  const tip = page.getByRole('tooltip');
  await expect(tip).toContainText('Vault of Glass');
  await expect(tip).toContainText(/Venus · Raid · 1 encounter/i);
  await expect(tip).toContainText('Guardians make their own fate.');
  await expect(tip).toContainText('1 / 1');
  await expect(page.getByRole('heading', { name: 'Raids' })).toBeVisible();
});

test('arrow keys move the selection between planets', async ({ page }) => {
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: /^Vault of Glass, Venus/ })).not.toHaveAttribute(
    'aria-current',
    'true',
  );
  await expect(page.locator('.rc-planet__hit[aria-current="true"]')).toHaveCount(1);
});

test('F opens the selected raid', async ({ page }) => {
  await page.keyboard.press('f');
  await expect(page).toHaveURL(/\/raids\/vault-of-glass\/$/);
  await expect(page.getByRole('heading', { name: "Atheon, Time's Conflux" })).toBeVisible();
});

test('Enter on a focused planet button acts on that planet, not the selected one', async ({
  page,
}) => {
  const kingsFall = page.getByRole('button', { name: /^King's Fall/ });
  await kingsFall.focus();
  // Native activation selects the focused planet (and never opens Vault of Glass)...
  await page.keyboard.press('Enter');
  await expect(kingsFall).toHaveAttribute('aria-current', 'true');
  await expect(page).toHaveURL('/');
  // ...and Enter on the already selected planet opens it.
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/raids\/kings-fall\/$/);
});

test('search filters planets and Enter opens the first match', async ({ page }) => {
  await page.keyboard.press('/');
  const input = page.getByRole('searchbox', { name: 'Search raids and encounters' });
  await expect(input).toBeFocused();
  await input.fill('crota');
  await expect(page.locator('[data-planet="crotas-end"]')).not.toHaveClass(/is-dimmed/);
  await expect(page.locator('[data-planet="deep-stone-crypt"]')).toHaveClass(/is-dimmed/);
  await input.press('Enter');
  await expect(page).toHaveURL(/\/raids\/crotas-end\/$/);
});

test('Esc opens the menu', async ({ page }) => {
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('navigation', { name: 'Menu' }).getByRole('link', { name: 'Styleguide' }),
  ).toBeVisible();
});

test('the menu takes focus and gives it back on Esc', async ({ page }) => {
  const kingsFall = page.getByRole('button', { name: /^King's Fall/ });
  await kingsFall.focus();
  await page.keyboard.press('Escape');
  const menu = page.getByRole('navigation', { name: 'Menu' });
  await expect(menu.getByRole('link', { name: 'Styleguide' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(kingsFall).toBeFocused();
});

test('the selected planet is described by the tooltip', async ({ page }) => {
  await expect(page.getByRole('button', { name: /^Vault of Glass/ })).toHaveAttribute(
    'aria-describedby',
    'director-tip',
  );
  await expect(page.getByRole('tooltip')).toHaveAttribute('id', 'director-tip');
});

test('the Director loads without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.reload();
  await expect(page.getByRole('tooltip')).toBeVisible();
  expect(errors).toEqual([]);
});

test("the tooltip stays off the selected planet's own label", async ({ page }) => {
  await page.getByRole('button', { name: /^King's Fall/ }).click();
  const label = page.locator('[data-planet="kings-fall"] .rc-planet__label');
  await label.waitFor({ state: 'attached' });
  const tip = page.getByRole('tooltip');
  await expect(tip).toContainText("King's Fall");
  const [t, l] = await Promise.all([tip.boundingBox(), label.boundingBox()]);
  if (!t || !l) throw new Error('tooltip or label has no bounding box');
  const intersects =
    t.x < l.x + l.width && l.x < t.x + t.width && t.y < l.y + l.height && l.y < t.y + t.height;
  expect(intersects).toBe(false);
});

test.describe('portrait phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the tooltip stays off the selected planet's own label", async ({ page }) => {
    // Vault of Glass is the featured raid, so it starts selected (clicking it would open it).
    await expect(page.getByRole('button', { name: /^Vault of Glass/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
    const label = page.locator('[data-planet="vault-of-glass"] .rc-planet__label');
    await label.waitFor({ state: 'attached' });
    const tip = page.getByRole('tooltip');
    await expect(tip).toContainText('Vault of Glass');
    const [t, l] = await Promise.all([tip.boundingBox(), label.boundingBox()]);
    if (!t || !l) throw new Error('tooltip or label has no bounding box');
    const intersects =
      t.x < l.x + l.width && l.x < t.x + t.width && t.y < l.y + l.height && l.y < t.y + t.height;
    expect(intersects).toBe(false);
  });
});
