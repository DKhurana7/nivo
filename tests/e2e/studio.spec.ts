import { test, expect } from '@playwright/test';
import { makeApp } from '../../server/app';
import { database, addUser } from '../../server/db';
import { seedWorkspace } from '../../src/lib/seed';
import { randomBytes, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
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
test.beforeEach(async ({ context }) => {
  await context.route('**/api/**', async (route) => {
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
test('two studio tabs reject a stale project save and export pending changes', async ({
  page,
  context,
}) => {
  await signIn(page);
  const other = await context.newPage();
  await other.goto('/#boq');
  await other.getByLabel('Choose project').selectOption('p2');
  await other.getByRole('button', { name: 'Project details', exact: true }).click();
  await page.goto('/#boq');
  await page.getByRole('button', { name: 'Project details', exact: true }).click();
  await page.getByLabel('Project name').fill('First tab saved project');
  await page.getByRole('button', { name: 'Save project details', exact: true }).click();
  const stored = () =>
    JSON.parse((db.prepare('SELECT data FROM workspaces WHERE user_id=?').get(id) as any).data);
  await expect.poll(() => stored().projects[0].name).toBe('First tab saved project');
  await other.getByLabel('Project name').fill('Second tab pending project');
  await other.getByRole('button', { name: 'Save project details', exact: true }).click();
  await expect(other.getByRole('alert')).toContainText('Another session changed');
  await expect(other.locator('main h1')).toHaveText('Second tab pending project');
  expect(stored().projects[1].name).toBe('Atlas Office');
  await other.getByRole('button', { name: 'Open settings', exact: true }).click();
  const downloading = other.waitForEvent('download');
  await other.getByRole('button', { name: 'Export full backup', exact: true }).click();
  const file = await downloading;
  const backup = JSON.parse(readFileSync((await file.path())!, 'utf8'));
  expect(backup.workspace.projects[1].name).toBe('Second tab pending project');
  expect(stored().projects[0].name).toBe('First tab saved project');
  await other.close();
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

test('studio import and backup restore retain the original workbook byte for byte', async ({
  page,
}) => {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Client');
  sheet.addRow(['Description', 'Unit', 'Quantity', 'Rate', 'Amount']);
  sheet.addRow(['Synthetic cable', 'm', 10, null, null]);
  book.addWorksheet('Private terms').getCell('A1').value = 'Retain this source note';
  const bytes = Buffer.from(await book.xlsx.writeBuffer());
  const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex');
  await signIn(page);
  await page.goto('/#boq');
  await page.getByLabel('Choose project').selectOption('p2');
  await page.getByRole('button', { name: 'Import Excel', exact: true }).click();
  await page
    .getByLabel('Choose Excel workbook')
    .setInputFiles({ name: 'synthetic.xlsx', mimeType: 'application/octet-stream', buffer: bytes });
  await page.getByRole('combobox', { name: 'Rate column', exact: true }).selectOption('4');
  await page.getByRole('checkbox', { name: /I have checked/ }).check();
  await page.getByRole('button', { name: 'Import 1 items', exact: true }).click();
  const stored = () =>
    JSON.parse((db.prepare('SELECT data FROM workspaces WHERE user_id=?').get(id) as any).data);
  await expect.poll(() => stored().projects[1].items[0].description).toBe('Synthetic cable');
  const workbookId = stored().projects[1].workbookId;
  expect(
    hash(
      Buffer.from(
        (db.prepare('SELECT bytes FROM files WHERE user_id=? AND id=?').get(id, workbookId) as any)
          .bytes,
      ),
    ),
  ).toBe(hash(bytes));
  await page.goto('/#settings');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export full backup', exact: true }).click();
  const file = await downloading;
  const backup = JSON.parse(readFileSync((await file.path())!, 'utf8'));
  expect(hash(Buffer.from(backup.workbooks[workbookId], 'base64'))).toBe(hash(bytes));
  await page.getByRole('button', { name: 'Start an empty workspace', exact: true }).click();
  await page.getByRole('button', { name: 'Start empty', exact: true }).click();
  await expect.poll(() => stored().projects.length).toBe(0);
  await page.getByLabel('Restore a backup', { exact: true }).setInputFiles((await file.path())!);
  await page.getByRole('button', { name: 'Restore workspace', exact: true }).click();
  await expect.poll(() => stored()).toEqual(backup.workspace);
  await page.reload();
  await expect(page.locator('.data-counts')).toContainText('3 projects');
  expect(
    hash(
      Buffer.from(
        (db.prepare('SELECT bytes FROM files WHERE user_id=? AND id=?').get(id, workbookId) as any)
          .bytes,
      ),
    ),
  ).toBe(hash(bytes));
});
