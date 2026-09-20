import { mkdirSync } from 'node:fs';
import { basename, resolve } from 'node:path';

import { expect, type Locator, type Page, test } from '@playwright/test';

const demoPassword = 'AcademicHubDemo2026!';
const studentEmail = 'maria.student@academic-hub.local';
const professorEmail = 'markos.professor@academic-hub.local';

const demoCourseCode = 'CS-ALG-201';
const continueNodeTitle = 'Ανάλυση αλγορίθμων διαίρει-και-βασίλευε';
const verifiedQuestionTitle =
  'Πότε δεν μπορεί να εφαρμοστεί το κύριο θεώρημα σε μια αναδρομική σχέση;';
const verifiedQuestionPage = 7;
const verifiedQuestionDocumentTitle =
  'Εβδομάδα 5 - Διαίρει και Βασίλευε: Ταξινόμηση και Αναδρομή';
const confusionQuestionTitle =
  'Ασάφεια στη χαλάρωση ακμών και στα αρνητικά βάρη';
const demoProfessorAnswer =
  'Η χαλάρωση ακμής είναι ασφαλής μόνο όσο καμία μελλοντική ακμή δεν μπορεί να μειώσει μια ήδη οριστικοποιημένη απόσταση. Με αρνητικά βάρη η υπόθεση αυτή καταρρέει, οπότε χρησιμοποιούμε Bellman-Ford. Θα προσθέσω αναλυτικό αντιπαράδειγμα στην επόμενη διάλεξη.';

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

function breadcrumbs(page: Page): Locator {
  return page.getByRole('navigation', { name: 'Διαδρομή σελίδας' });
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
      page.getByRole('heading', { name: 'Ανοιχτές απορίες' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: continueNodeTitle }),
    ).toBeVisible();
    await capture(page, 'uc01-01-student-dashboard.png');

    await page.getByRole('link', { name: 'Συνέχεια στον χάρτη' }).click();
    await expect(page).toHaveURL(/tab=roadmap&node=/);
    const detailsPanel = page.getByLabel('Λεπτομέρειες κόμβου');
    await expect(
      detailsPanel.getByRole('heading', { name: continueNodeTitle }),
    ).toBeVisible();
    await expect(
      detailsPanel.getByRole('heading', { name: 'Προαπαιτούμενα' }),
    ).toBeVisible();
    await expect(
      detailsPanel.getByRole('heading', { name: 'Πόροι μελέτης' }),
    ).toBeVisible();
    // The map fits all six nodes by default, which shrinks the cards below a
    // readable size for a printed figure. Zoom in on the selected node so the
    // screenshot shows it together with its immediate neighbours.
    const selectedNodeCard = page
      .locator('.react-flow__node')
      .filter({ hasText: continueNodeTitle });
    await selectedNodeCard.hover();
    for (let step = 0; step < 2; step += 1) {
      await page.mouse.wheel(0, -240);
      await page.waitForTimeout(150);
    }
    await expect(selectedNodeCard).toBeVisible();
    await capture(page, 'uc01-04-course-roadmap.png');

    // The verified answers are collected on the activity page, not on the
    // dashboard, so that is where the student picks the thread back up.
    await page.goto('/app/activity');
    await expect(
      page.getByRole('heading', { name: 'Πρόσφατες επίσημες απαντήσεις' }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: new RegExp(verifiedQuestionTitle) })
      .first()
      .click();
    await expect(
      page.getByRole('heading', { name: verifiedQuestionTitle }),
    ).toBeVisible();
    await expect(page.getByText('Επίσημη απάντηση')).toBeVisible();
    await expect(breadcrumbs(page)).toContainText(demoCourseCode);
    await capture(page, 'uc01-02-verified-contextual-answer.png');

    await page.getByRole('button', { name: 'Άνοιγμα εγγράφου' }).click();
    // The button navigates client-side, so wait for the document route before
    // reading the URL back; otherwise the thread URL can still be current.
    await expect(page).toHaveURL(/\/documents\/[^/?]+$/);
    const documentUrl = new URL(page.url());
    documentUrl.searchParams.set('page', String(verifiedQuestionPage));
    await page.goto(documentUrl.toString());
    await expect(
      page.getByRole('heading', { name: verifiedQuestionDocumentTitle }),
    ).toBeVisible();
    const anchoredPage = page.locator(
      `[data-page-number="${verifiedQuestionPage}"]`,
    );
    await anchoredPage.scrollIntoViewIfNeeded();
    await expect(
      page.getByLabel(`Σελίδα ${verifiedQuestionPage}`, { exact: true }),
    ).toBeVisible();
    await page.getByRole('tab', { name: 'Απορίες' }).click();
    await expect(page.getByText(verifiedQuestionTitle)).toBeVisible();
    await expect(
      page.getByText(`Σελίδα ${verifiedQuestionPage}`),
    ).toBeVisible();
    await expect(breadcrumbs(page)).toContainText(demoCourseCode);
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

    await page.getByRole('link', { name: 'Analytics' }).click();
    await expect(
      page.getByRole('heading', { name: 'Analytics' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Απορίες ανά μάθημα' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Πρόοδος φοιτητών ανά μάθημα' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Σημεία σύγχυσης' }),
    ).toBeVisible();
    await expect(
      page.locator('.analytics-confusion-item').first(),
    ).toContainText(demoCourseCode);
    await capture(page, 'uc02-04-professor-analytics.png');

    await page.goto('/app');
    await page
      .getByRole('button', { name: new RegExp(confusionQuestionTitle) })
      .first()
      .click();
    await expect(
      page.getByRole('heading', { name: confusionQuestionTitle }),
    ).toBeVisible();
    await removeDemoReplyIfPresent(page);
    await expect(page.getByText('χαλάρωση ακμής').first()).toBeVisible();
    await expect(page.getByLabel('Νέα απάντηση')).toBeVisible();
    await expect(breadcrumbs(page)).toContainText(demoCourseCode);
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
