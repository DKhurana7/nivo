import { test, expect, type Page } from '@playwright/test';
import { database, addUser } from '../../server/db';
import { makeApp } from '../../server/app';
import { seedWorkspace } from '../../src/lib/seed';
import { tourSteps } from '../../src/lib/walkthrough';
const db = database(':memory:');
const password = 'synthetic walkthrough password';
const ids = ['new', 'empty', 'complete'].map((name) =>
  addUser(db, `${name}@example.test`, password, 'Tour studio'),
);
for (const id of [ids[0], ids[2]])
  db.prepare('UPDATE workspaces SET data=? WHERE user_id=?').run(
    JSON.stringify(seedWorkspace()),
    id,
  );
const app = makeApp({ db });
test.beforeAll(async () => {
  await app.listen({ host: '127.0.0.1', port: 8791 });
});
test.afterAll(async () => {
  await app.close();
  db.close();
});
test.beforeEach(async ({ context }) => {
  await context.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({
      url: `http://127.0.0.1:8791${url.pathname}${url.search}`,
    });
    await route.fulfill({ response });
  });
});
async function signIn(page: Page, name: string) {
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill(`${name}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Studio server connected', { exact: true })).toBeVisible();
}
const guide = (page: Page) => page.getByRole('dialog', { name: 'Platform walkthrough' });

test('first login, skip, fresh browser login and manual replay use account memory', async ({
  page,
  browser,
}) => {
  await signIn(page, 'new');
  await expect(guide(page)).toBeVisible();
  await expect(guide(page).getByRole('heading', { name: 'Welcome to Nivo' })).toBeFocused();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Skip tour', exact: true }).click();
  await expect(guide(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Help & walkthrough', exact: true })).toBeFocused();
  await expect
    .poll(
      () => (db.prepare('SELECT status FROM onboarding WHERE user_id=?').get(ids[0]) as any).status,
    )
    .toBe('skipped');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Help & walkthrough', exact: true })).toBeVisible();
  await expect(guide(page)).toHaveCount(0);
  const context = await browser.newContext();
  await context.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      response: await route.fetch({ url: `http://127.0.0.1:8791${url.pathname}` }),
    });
  });
  const other = await context.newPage();
  await signIn(other, 'new');
  await expect(guide(other)).toHaveCount(0);
  await other.getByRole('button', { name: 'Help & walkthrough', exact: true }).click();
  await expect(guide(other)).toBeVisible();
  await other.keyboard.press('Escape');
  await expect(guide(other)).toHaveCount(0);
  await context.close();
});

test('every feature can be toured without changing workspace, uploading sources or calling', async ({
  page,
}) => {
  const before = db.prepare('SELECT * FROM workspaces WHERE user_id=?').get(ids[2]);
  const mutations: string[] = [];
  page.on('request', (r) => {
    if (r.method() !== 'GET' && /\/api\/(workspace|files|calls)/.test(r.url()))
      mutations.push(r.url());
  });
  await signIn(page, 'complete');
  const dialog = guide(page);
  for (let index = 0; index < tourSteps.length; index++) {
    const step = tourSteps[index];
    await expect(dialog.getByRole('heading', { name: step.title, exact: true })).toBeVisible();
    await expect(page.locator('.tour-card')).toHaveAttribute('data-step', step.id);
    await expect(page).toHaveURL(new RegExp(`#${step.page}$`));
    if (step.id === 'document-upload') {
      await expect(page.locator('.tour-availability')).toHaveCount(0);
      await expect(page.locator('[data-tour-spotlight]')).toBeVisible();
      await page.screenshot({ path: 'test-results/tour-desktop.png' });
    }
    await dialog
      .getByRole('button', {
        name: index === tourSteps.length - 1 ? 'Finish tour' : 'Next',
        exact: true,
      })
      .click();
  }
  await expect(dialog).toHaveCount(0);
  await expect
    .poll(
      () => (db.prepare('SELECT status FROM onboarding WHERE user_id=?').get(ids[2]) as any).status,
    )
    .toBe('completed');
  expect(db.prepare('SELECT * FROM workspaces WHERE user_id=?').get(ids[2])).toEqual(before);
  expect(mutations).toEqual([]);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Help & walkthrough', exact: true })).toBeVisible();
  await expect(dialog).toHaveCount(0);
});

test('empty phone studio keeps all explanations available, contains focus and remembers an interrupted first visit', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await signIn(page, 'empty');
  const dialog = guide(page);
  await dialog
    .getByLabel('Jump to tour feature')
    .selectOption(String(tourSteps.findIndex((s) => s.id === 'document-upload')));
  await expect(page.locator('.tour-availability')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/tour-phone.png' });
  const next = dialog.getByRole('button', { name: 'Next', exact: true });
  await next.focus();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Skip tour', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(next).toBeFocused();
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog', { name: 'Find your next step' })).toHaveCount(0);
  // A reload during the first display does not force the tour again.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Help & walkthrough', exact: true })).toBeVisible();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Help & walkthrough', exact: true }).click();
  await dialog.getByLabel('Jump to tour feature').selectOption(String(tourSteps.length - 1));
  await dialog.getByRole('button', { name: 'Finish tour', exact: true }).click();
  await expect(dialog).toHaveCount(0);
});
