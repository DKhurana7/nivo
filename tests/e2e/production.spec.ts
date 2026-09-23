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
  await page.goto('http://127.0.0.1:8790/#boq');
  await page.getByRole('button', { name: 'Export BOQ', exact: true }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: /Client quotation/ }).click();
  await page.getByRole('button', { name: 'Download Excel', exact: true }).click();
  expect((await downloading).suggestedFilename()).toContain('Aranya');
  await page.reload();
  await expect(page.locator('main h1')).toContainText('Aranya');
  expect(violations).toEqual([]);
});
