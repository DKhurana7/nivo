import { test, expect } from '@playwright/test';
import { makeApp } from '../../server/app';
import { database, addUser } from '../../server/db';
import { seedWorkspace } from '../../src/lib/seed';
import { randomBytes } from 'node:crypto';
const password = randomBytes(20).toString('hex');
const db = database(':memory:');
const id = addUser(db, 'pilot@example.test', password, 'Pilot Studio');
const seed = seedWorkspace();
seed.settings.company = 'Pilot Studio';
db.prepare('UPDATE workspaces SET data=? WHERE user_id=?').run(JSON.stringify(seed), id);
const app = makeApp({ db });
test.beforeAll(async () => {
  await app.listen({ port: 8789, host: '127.0.0.1' });
});
test.afterAll(async () => {
  await app.close();
  db.close();
});
test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({
      url: `http://127.0.0.1:8789${url.pathname}${url.search}`,
    });
    await route.fulfill({ response });
  });
});
async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill('pilot@example.test');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Studio server connected')).toBeVisible();
}
test('studio login, server save/reload, voice readiness, signout and responsive access', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Enter your studio' })).toBeVisible();
  await page.screenshot({ path: 'test-results/studio-login-390.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await page.goto('/#settings');
  await page.getByLabel('Studio name').fill('Pilot saved remotely');
  await page.getByRole('button', { name: 'Save studio details' }).click();
  await expect
    .poll(
      () =>
        JSON.parse((db.prepare('SELECT data FROM workspaces WHERE user_id=?').get(id) as any).data)
          .settings.company,
    )
    .toBe('Pilot saved remotely');
  await page.reload();
  await expect(page.getByLabel('Studio name')).toHaveValue('Pilot saved remotely');
  await page.goto('/#enquiries');
  await page.getByRole('button', { name: 'Prepare enquiry', exact: true }).click();
  await page.getByRole('button', { name: 'Prepare brief', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Test in browser' })).toBeDisabled();
  await expect(page.getByText('Server setup needed:', { exact: false })).toBeVisible();
  await page.screenshot({ path: 'test-results/voice-desk-1440.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/voice-desk-390.png', fullPage: true });
  await page.keyboard.press('Escape');
  await page.goto('/#settings');
  await page.getByRole('button', { name: 'Sign out of studio' }).click();
  await expect(page.getByRole('heading', { name: 'Enter your studio' })).toBeVisible();
});
test('conflicting studio session preserves the local pending changes', async ({ page }) => {
  await signIn(page);
  await page.goto('/#settings');
  db.prepare('UPDATE workspaces SET revision=revision+1 WHERE user_id=?').run(id);
  await page.getByLabel('Studio name').fill('Unsaved conflicting edit');
  await page.getByRole('button', { name: 'Save studio details' }).click();
  await expect(page.getByRole('alert')).toContainText('Another session changed');
  await expect(page.getByLabel('Studio name')).toHaveValue('Unsaved conflicting edit');
});
test('voice draft review preserves evidence and does not assume a different quoted unit', async ({
  page,
}) => {
  const workspace = JSON.parse(
    (db.prepare('SELECT data FROM workspaces WHERE user_id=?').get(id) as any).data,
  );
  const enquiry = workspace.enquiries[0];
  const item = workspace.projects
    .find((p: any) => p.id === enquiry.projectId)
    .items.find((i: any) => enquiry.itemIds.includes(i.id));
  const evidence = 'The price is 125 rupees per carton excluding GST, supply only.';
  const callId = 'draft-review-call';
  db.prepare(
    'INSERT INTO calls(id,user_id,enquiry_id,mode,status,room,created,updated,brief,request_id,transcript,drafts) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
  ).run(
    callId,
    id,
    enquiry.id,
    'browser',
    'ended',
    'test-room',
    Date.now(),
    Date.now(),
    '{}',
    'draft-review-request',
    JSON.stringify([{ role: 'user', text: evidence }]),
    JSON.stringify([
      {
        itemId: item.id,
        unit: 'carton',
        cost: 125,
        basis: 'excluding-gst',
        brand: '',
        terms: 'Supply only',
        evidence,
        needsReview: true,
      },
    ]),
  );
  await signIn(page);
  await page.goto('/#enquiries');
  await page.locator('.enquiry-row').first().click();
  await page.getByRole('button', { name: 'Review & record quotation' }).click();
  const form = page.getByRole('dialog', { name: 'Record a quotation' });
  await expect(form.getByLabel('Unit cost (₹)', { exact: true })).toHaveValue('');
  await expect(form.locator('textarea[name="notes"]')).toContainText(evidence);
  await form.getByLabel('Unit cost (₹)', { exact: true }).fill('25');
  await form
    .getByLabel('Exact specification')
    .fill('Confirmed specification and manually verified conversion');
  await form.getByLabel('Delivery location').fill('Synthetic test site');
  await form.getByRole('button', { name: 'Save quotation' }).click();
  await expect(form).toHaveCount(0);
  await expect
    .poll(() => {
      const saved = JSON.parse(
        (db.prepare('SELECT data FROM workspaces WHERE user_id=?').get(id) as any).data,
      );
      return saved.rates.find((r: any) => r.sourceRef === `Voice call ${callId}`)?.notes;
    })
    .toContain(evidence);
});
