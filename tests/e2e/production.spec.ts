import { quotationPdf } from './quotation-fixture';
import { test, expect } from '@playwright/test';
import { makeApp } from '../../server/app';
import { database, addUser } from '../../server/db';
import { randomBytes } from 'node:crypto';
import { seedWorkspace } from '../../src/lib/seed';

// Serve the actual built assets and security headers, without Vite or route mocks.
const db = database(':memory:');
const password = randomBytes(24).toString('hex');
const id = addUser(db, 'build@example.test', password, 'Build smoke');
db.prepare('UPDATE workspaces SET data=? WHERE user_id=?').run(JSON.stringify(seedWorkspace()), id);
let app: ReturnType<typeof makeApp>;
test.beforeAll(async () => {
  const old = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = 'http://127.0.0.1:8790';
  app = makeApp({ db, production: true });
  if (old === undefined) delete process.env.APP_ORIGIN;
  else process.env.APP_ORIGIN = old;
  await app.listen({ host: '127.0.0.1', port: 8790 });
});
test.afterAll(async () => {
  await app.close();
  db.close();
});
test('built app works with production cookies and CSP and downloads a quotation', async ({
  page,
}) => {
  const violations: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && /Content Security Policy|Refused to/i.test(message.text()))
      violations.push(message.text());
  });
  const response = await page.goto('http://127.0.0.1:8790');
  expect(response?.headers()['content-security-policy']).toContain("default-src 'self'");
  await page.getByLabel('Email', { exact: true }).fill('build@example.test');
  await page.getByLabel('Password', { exact: true }).fill(password);
  const loggingIn = page.waitForResponse((r) => r.url().endsWith('/api/login'));
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const login = await loggingIn;
  expect(login.status()).toBe(200);
  expect((await login.allHeaders())['set-cookie']).toContain('Secure');
  await expect(page.getByText('Studio server connected', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Skip tour', exact: true }).click();
  await page.goto('http://127.0.0.1:8790/#boq');
  await page.getByRole('button', { name: 'Export BOQ', exact: true }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: /Client quotation/ }).click();
  await page.getByRole('button', { name: 'Download Excel', exact: true }).click();
  expect((await downloading).suggestedFilename()).toContain('Aranya');
  await page.reload();
  await expect(page.locator('main h1')).toContainText('Aranya');
  await page.getByRole('button', { name: 'Import vendor quotation', exact: true }).click();
  await page
    .getByLabel('Vendor PDF or Excel file')
    .setInputFiles({ name: 'production.pdf', mimeType: 'application/pdf', buffer: quotationPdf() });
  await expect(page.getByLabel('Unit rate column')).toHaveValue('3');
  await page.getByRole('button', { name: 'Extract quotation rows', exact: true }).click();
  await expect(page.locator('.document-offer')).toContainText('1,180');
  await page.getByRole('combobox', { name: 'Quotation vendor', exact: true }).selectOption('v1');
  await page.locator('.document-offer').click();
  await page.getByLabel('Matched BOQ item').selectOption(seedWorkspace().projects[0].items[0].id);
  await page.getByLabel('Quoted tax basis').selectOption('excluding-gst');
  await page.getByLabel('Document quotation date').fill('2026-09-23');
  await page.getByLabel('Document valid until').fill('2099-12-31');
  await page.getByLabel('Verified commercial terms').fill('Synthetic production storage test only');
  await page.getByRole('checkbox', { name: /I checked the original/ }).check();
  await page.getByRole('button', { name: 'Save reviewed quotation' }).click();
  await expect(
    page.getByText('Quotation saved with its source file.', { exact: false }),
  ).toBeVisible();
  const stored = () =>
    JSON.parse((db.prepare('SELECT data FROM workspaces WHERE user_id=?').get(id) as any).data);
  await expect.poll(() => stored().rates[0].document?.filename).toBe('production.pdf');
  const bytes = (
    db
      .prepare('SELECT bytes FROM files WHERE user_id=? AND id=?')
      .get(id, stored().rates[0].document.fileId) as any
  ).bytes;
  expect(Buffer.from(bytes)).toEqual(quotationPdf());
  await page.reload();
  expect(stored().rates[0].cost).toBe(1180);
  expect(violations).toEqual([]);
});
