import { expect, type Page, test } from '@playwright/test';

const password = 'AcademicHubDemo2026!';

const accounts = [
  {
    role: 'admin',
    email: 'admin@academic-hub.local',
    heading: 'Διαχειριστικό workspace',
  },
  {
    role: 'professor',
    email: 'professor@academic-hub.local',
    heading: 'Επισκόπηση',
  },
  {
    role: 'student',
    email: 'maria.student@academic-hub.local',
    heading: 'Επισκόπηση',
  },
] as const;

async function login(page: Page, email: string, accountPassword = password) {
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Κωδικός', { exact: true }).fill(accountPassword);
  await page.getByRole('button', { name: 'Σύνδεση στο Academic Hub' }).click();
}

test.describe('auth journeys', () => {
  for (const account of accounts) {
    test(`${account.role} can sign in through the public login form`, async ({
      page,
    }) => {
      await login(page, account.email);

      await expect(page).toHaveURL(/\/app$/);
      await expect(
        page.getByRole('heading', { name: account.heading }),
      ).toBeVisible();
    });
  }

  test('rejects a wrong password without opening the protected workspace', async ({
    page,
  }) => {
    await login(page, accounts[2].email, 'definitely-wrong-password');

    await expect(page).toHaveURL('/');
    await expect(
      page.getByText(
        'Δεν ήταν δυνατή η σύνδεση. Έλεγξε το email και τον κωδικό σου.',
      ),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: accounts[2].heading }),
    ).toHaveCount(0);
  });

  test('keeps an authenticated session across reloads', async ({ page }) => {
    await login(page, accounts[2].email);

    await expect(
      page.getByRole('heading', { name: accounts[2].heading }),
    ).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/\/app$/);
    await expect(
      page.getByRole('heading', { name: accounts[2].heading }),
    ).toBeVisible();
  });

  test('logout clears the session and blocks protected routes', async ({
    page,
  }) => {
    await login(page, accounts[2].email);
    await expect(
      page.getByRole('heading', { name: accounts[2].heading }),
    ).toBeVisible();

    await page.getByRole('button', { name: /Μενού χρήστη/ }).click();
    await page.getByRole('menuitem', { name: 'Αποσύνδεση' }).click();

    await expect(page).toHaveURL('/');
    await expect(
      page.getByRole('heading', { name: 'Καλώς ήρθες ξανά' }),
    ).toBeVisible();

    await page.goto('/app');
    await expect(page).toHaveURL('/');
    await expect(
      page.getByRole('heading', { name: 'Καλώς ήρθες ξανά' }),
    ).toBeVisible();
  });
});
