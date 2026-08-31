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

test('navigates to the login route from the main nav', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('link', { name: 'Σύνδεση' }).click();

  await expect(page).toHaveURL('/login');
  await expect(
    page.getByRole('heading', {
      name: 'Η αυθεντικοποίηση θα προστεθεί στο επόμενο βήμα.',
    }),
  ).toBeVisible();
});
