/** Read-only browser and source-retention check for the prepared local studio. */
import { chromium, expect } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const login = JSON.parse(await readFile('data/local-studio-login.json', 'utf8'));
const prepared = JSON.parse(
  await readFile(process.argv[2] || 'data/raisina/prepared/workspace.nivo.json', 'utf8'),
);
const project = prepared.workspace.projects[0];
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
// Read-only readiness checks must not consume the owner's first-login walkthrough.
// Real account persistence and the full tour are tested in onboarding.spec.ts.
await page.route('**/api/onboarding', (route) => route.fulfill({ json: { showTour: false } }));
await mkdir('data/verification', { recursive: true });
try {
  await page.goto(login.url);
  await page.getByLabel('Email', { exact: true }).fill(login.email);
  await page.getByLabel('Password', { exact: true }).fill(login.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Studio server connected')).toBeVisible();
  const saved = await (await page.request.get(`${login.url}/api/workspace`)).json();
  expect(saved.workspace.projects[0].items).toHaveLength(project.items.length);
  expect(saved.workspace.projects[0].items.every((i) => i.cost === null)).toBe(true);
  const voice = await (await page.request.get(`${login.url}/api/voice/status`)).json();
  expect(
    voice.configured && voice.reachable && voice.agentVerified && voice.extractionConfigured,
  ).toBe(true);
  const source = await (
    await page.request.get(`${login.url}/api/files/${project.workbookId}`)
  ).body();
  const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
  expect(hash(source)).toBe(hash(Buffer.from(prepared.workbooks[project.workbookId], 'base64')));
  await page.goto(`${login.url}/#boq`);
  await expect(page.getByRole('heading', { name: project.name, exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: project.name, exact: true })).toBeVisible();
  await page.screenshot({ path: 'data/verification/raisina-desktop.png', fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'data/verification/raisina-phone.png', fullPage: false });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Export BOQ', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Excel preview', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Fill the original workbook/ }).click();
  await expect(page.getByRole('region', { name: 'Excel preview', exact: true })).toBeVisible();
  expect(await page.getByLabel('Preview sheet').locator('option').count()).toBe(5);
  await expect(page.getByRole('button', { name: 'Download Excel', exact: true })).toBeDisabled();
  await page.getByRole('region', { name: 'Excel preview', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'data/verification/raisina-export-preview.png', fullPage: false });
  await page.keyboard.press('Escape');
  const unchanged = await (await page.request.get(`${login.url}/api/workspace`)).json();
  expect(unchanged.workspace).toEqual(saved.workspace);
  console.log(
    `Persistent studio verified: ${project.items.length} unpriced items, original workbook hash preserved, reload, phone layout and five-sheet original export preview passed.`,
  );
} finally {
  await browser.close();
}
