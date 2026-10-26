import { expect, test } from '@playwright/test';

test('raid scene shows the real encounter and a route to its trainer', async ({ page }) => {
  await page.goto('/raids/vault-of-glass/');
  await expect(page.getByRole('heading', { name: 'Vault of Glass', exact: true })).toBeVisible();
  await expect(page.locator('.raid-director__space .rc-planet')).toHaveCount(1);
  await expect(page.getByRole('list')).toHaveCount(1);
  await expect(page.getByRole('link', { name: "Atheon, Time's Conflux" })).toHaveAttribute(
    'href',
    '/raids/vault-of-glass/atheon/trainer/',
  );
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
