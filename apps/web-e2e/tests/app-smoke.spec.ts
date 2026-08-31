import { expect, test } from '@playwright/test';

test('renders the web app shell', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      name: 'Πρωτότυπο μαθησιακής πλατφόρμας',
    }),
  ).toBeVisible();

  await expect(page.getByRole('link', { name: 'Αρχική' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Σύνδεση' })).toBeVisible();
});
