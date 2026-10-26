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
