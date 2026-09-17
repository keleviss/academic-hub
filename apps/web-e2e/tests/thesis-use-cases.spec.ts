import { mkdirSync } from 'node:fs';
import { basename, resolve } from 'node:path';

import { expect, type Locator, type Page, test } from '@playwright/test';

const demoPassword = 'AcademicHubDemo2026!';
const studentEmail = 'maria.student@academic-hub.local';
const professorEmail = 'professor@academic-hub.local';

const verifiedQuestionTitle =
  'Πότε μια επαναλαμβανόμενη ερώτηση γίνεται διδακτική ενέργεια;';
const confusionQuestionTitle = 'Ερμηνεία θερμικού χάρτη σύγχυσης';
const demoProfessorAnswer =
  'Η ένταση του χρώματος συνδυάζει το πλήθος των φοιτητών με τη συχνότητα του ίδιου σήματος σύγχυσης. Ανοίγουμε το σχετικό απόσπασμα πριν αποφασίσουμε τη διδακτική παρέμβαση.';

const repositoryRoot =
  basename(process.cwd()) === 'web-app'
    ? resolve(process.cwd(), '..')
    : process.cwd();
const screenshotsDirectory = resolve(
  repositoryRoot,
  'thesis/figures/screenshots',
);

mkdirSync(screenshotsDirectory, { recursive: true });

test.use({
  colorScheme: 'light',
  locale: 'el-GR',
  viewport: { height: 1100, width: 1440 },
});

async function login(page: Page, email: string) {
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Κωδικός', { exact: true }).fill(demoPassword);
  await page.getByRole('button', { name: 'Σύνδεση στο Academic Hub' }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('heading', { name: 'Επισκόπηση' })).toBeVisible();
}

async function capture(page: Page, filename: string) {
  await page.screenshot({
    animations: 'disabled',
    caret: 'hide',
    path: resolve(screenshotsDirectory, filename),
  });
}

function replyPost(page: Page, body: string): Locator {
  return page.locator('article.thread-post').filter({ hasText: body });
}

async function removeDemoReplyIfPresent(page: Page) {
  const post = replyPost(page, demoProfessorAnswer);

  if ((await post.count()) === 0) return;

  const deleteButton = post.getByRole('button', { name: 'Διαγραφή' });
  if ((await deleteButton.count()) === 0) return;

  await deleteButton.click();
  await expect(post).toHaveCount(0);
}

test.describe('thesis demo use cases', () => {
  test('UC-01 φοιτητής: από την πρόοδο στο PDF και στην επίσημη απάντηση', async ({
    page,
  }) => {
    await login(page, studentEmail);
    await expect(page.getByText('Πρόοδος ύλης').first()).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Πρόσφατες επίσημες απαντήσεις' }),
    ).toBeVisible();
    await capture(page, 'uc01-01-student-dashboard.png');

    await page
      .getByRole('button', { name: new RegExp(verifiedQuestionTitle) })
      .first()
      .click();
    await expect(
      page.getByRole('heading', { name: verifiedQuestionTitle }),
    ).toBeVisible();
    await expect(page.getByText('Επίσημη απάντηση')).toBeVisible();
    await capture(page, 'uc01-02-verified-contextual-answer.png');

    await page.getByRole('button', { name: 'Άνοιγμα εγγράφου' }).click();
    const documentUrl = new URL(page.url());
    documentUrl.searchParams.set('page', '4');
    await page.goto(documentUrl.toString());
    await expect(
      page.getByRole('heading', {
        name: 'Εβδομάδα 3 - Σήματα Σύγχυσης και Διδακτική Ανατροφοδότηση',
      }),
    ).toBeVisible();
    const fourthPage = page.locator('[data-page-number="4"]');
    await fourthPage.scrollIntoViewIfNeeded();
    await expect(page.getByLabel('Σελίδα 4', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Απορίες' }).click();
    await expect(page.getByText(verifiedQuestionTitle)).toBeVisible();
    await expect(page.getByText('Σελίδα 4')).toBeVisible();
    await capture(page, 'uc01-03-pdf-contextual-question.png');
  });

  test('UC-02 καθηγητής: από το σήμα σύγχυσης στην επίσημη παρέμβαση', async ({
    page,
  }) => {
    await login(page, professorEmail);
    await expect(
      page.getByRole('heading', { name: 'Χρειάζονται απάντηση' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Σημεία σύγχυσης' }),
    ).toBeVisible();
    await capture(page, 'uc02-01-professor-dashboard.png');

    await page
      .getByRole('button', { name: new RegExp(confusionQuestionTitle) })
      .first()
      .click();
    await expect(
      page.getByRole('heading', { name: confusionQuestionTitle }),
    ).toBeVisible();
    await removeDemoReplyIfPresent(page);
    await expect(page.getByText('θερμικός χάρτης σύγχυσης')).toBeVisible();
    await expect(page.getByLabel('Νέα απάντηση')).toBeVisible();
    await capture(page, 'uc02-02-unanswered-contextual-thread.png');

    try {
      await page.getByLabel('Νέα απάντηση').fill(demoProfessorAnswer);
      await page.getByRole('button', { name: 'Απάντηση' }).click();

      const post = replyPost(page, demoProfessorAnswer);
      await expect(post).toBeVisible();
      await post.getByRole('button', { name: 'Σήμανση ως επίσημη' }).click();
      await expect(post.getByText('Επίσημη απάντηση')).toBeVisible();
      await expect(
        page.getByText('Επαληθευμένη', { exact: true }),
      ).toBeVisible();
      await capture(page, 'uc02-03-verified-professor-answer.png');
    } finally {
      await removeDemoReplyIfPresent(page);
    }
  });
});
