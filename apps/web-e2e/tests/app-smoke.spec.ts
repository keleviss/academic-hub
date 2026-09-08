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
      name: 'Καλώς ήρθες ξανά',
    }),
  ).toBeVisible();

  await expect(
    page.getByRole('navigation', { name: 'Κύρια πλοήγηση' }),
  ).not.toBeVisible();
});

test('redirects the legacy login route to the canonical index route', async ({
  page,
}) => {
  await page.goto('/login');

  await expect(page).toHaveURL('/');
  await expect(
    page.getByRole('heading', {
      name: 'Καλώς ήρθες ξανά',
    }),
  ).toBeVisible();
});

test('login fields support keyboard navigation', async ({ page }) => {
  await page.goto('/');
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

test('does not expose role URLs in the public login route', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page.getByRole('link', { name: /admin/i })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /professor/i })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /student/i })).toHaveCount(0);
});
