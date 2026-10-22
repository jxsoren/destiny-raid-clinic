import { expect, test } from '@playwright/test';

test('Escape on a raid page goes back to the Director', async ({ page }) => {
  await page.goto('/raids/vault-of-glass/');
  await expect(page.getByRole('heading', { name: /Vault of Glass/ }).first()).toBeVisible();
  // The island hydrates after load; keep pressing until its listener is installed.
  await expect(async () => {
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL('/', { timeout: 500 });
  }).toPass({ timeout: 15_000 });
});
