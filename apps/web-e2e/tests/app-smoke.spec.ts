import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({ json: { authenticated: false, user: null } }),
  );
});

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
      name: 'Καλώς ήρθες ξανά',
    }),
  ).toBeVisible();
});

test('login fields support keyboard navigation', async ({ page }) => {
  await page.goto('/login');
  const email = page.getByLabel('Email', { exact: true });
  const password = page.getByLabel('Κωδικός', { exact: true });
  await email.focus();
  await page.keyboard.press('Tab');
  await expect(password).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Εμφάνιση κωδικού' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(password).toHaveAttribute('type', 'text');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Σύνδεση στο Academic Hub' }),
  ).toBeFocused();
});
