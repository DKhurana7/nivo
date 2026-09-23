import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { seedWorkspace } from '../../src/lib/seed';
import type { Workspace } from '../../src/lib/types';
import ExcelJS from 'exceljs';

const headers = { 'X-Nivo-Request': '1' };
const button = (page: Page, name: string | RegExp) =>
  page.getByRole('button', { name, exact: typeof name === 'string' });
async function go(page: Page, path: string) {
  await page.evaluate((path) => {
    location.hash = path;
  }, path);
  await expect(page.locator('main')).toBeVisible();
}
async function close(page: Page) {
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function trap(page: Page) {
  for (let i = 0; i < 16; i++) {
    await page.keyboard.press('Tab');
    expect(
      await page.evaluate(() => !!document.activeElement?.closest('dialog, [role="dialog"]')),
    ).toBe(true);
  }
}

for (const mode of ['Local', 'Studio'] as const) {
  if (process.env.NIVO_AUDIT_MODE && process.env.NIVO_AUDIT_MODE !== mode) continue;
  test.describe(mode, () => {
    let cookieState: Awaited<ReturnType<BrowserContext['cookies']>> = [];
    let workspace: Workspace;
    const evidence: Record<string, string> = {};
    let testName = '';
    function verified(ids: string) {
      for (const id of ids.split(' '))
        evidence[id] =
          `PASS — ${testName}; real ${mode.toLowerCase()} persistence and browser assertions.`;
    }
    test.beforeAll(async ({ request }) => {
      if (mode !== 'Studio') return;
      const credentials = JSON.parse(readFileSync('data/audit-login.json', 'utf8'));
      expect(credentials.database).toBe('data/audit.sqlite');
      const account = credentials.accounts.find((a: any) => a.email === 'alpha@audit.local');
      // Never print credentials or attach them to a trace.
      const login = await request.post('http://127.0.0.1:8787/api/login', {
        headers: { ...headers, 'X-Forwarded-For': '198.18.1.1' },
        data: account,
      });
      expect(login.status()).toBe(200);
      cookieState = (await request.storageState()).cookies;
    });
    test.beforeEach(async ({ page, context }, info) => {
      // Each isolated audit scenario represents a different client. Production
      // throttling remains enabled; rapid automation must not share one IP bucket.
      await context.setExtraHTTPHeaders({
        'X-Forwarded-For': `198.18.0.${(info.testId.split('').reduce((n, c) => n + c.charCodeAt(0), 0) % 250) + 1}`,
      });
      testName = info.title;
      workspace = seedWorkspace();
      if (mode === 'Studio') {
        await context.addCookies(cookieState);
        let current = await context.request.get('http://127.0.0.1:8787/api/workspace');
        if (current.status() === 401) {
          const account = JSON.parse(readFileSync('data/audit-login.json', 'utf8')).accounts.find(
            (a: any) => a.email === 'alpha@audit.local',
          );
          expect(
            (
              await context.request.post('http://127.0.0.1:8787/api/login', {
                headers,
                data: account,
              })
            ).status(),
          ).toBe(200);
          cookieState = await context.cookies();
          current = await context.request.get('http://127.0.0.1:8787/api/workspace');
        }
        expect(current.status()).toBe(200);
        const { revision } = await current.json();
        const result = await context.request.put('http://127.0.0.1:8787/api/workspace', {
          headers,
          data: { revision, workspace },
        });
        expect(result.status()).toBe(200);
      }
      await page.goto('/');
      if (mode === 'Local') {
        await page.evaluate(
          (w) => localStorage.setItem('nivo.workspace.v1', JSON.stringify(w)),
          workspace,
        );
        await button(page, 'Explore the local demo').click();
      }
      await expect(page.locator('main h1')).toContainText('Your studio');
    });
    test.afterEach(async () => {
      mkdirSync('data/audit-ui', { recursive: true });
      writeFileSync(
        `data/audit-ui/${mode}-${testName.replace(/[^a-z0-9]+/gi, '-')}.json`,
        JSON.stringify(evidence, null, 2),
      );
    });
    async function saved(page: Page): Promise<Workspace> {
      if (mode === 'Local')
        return page.evaluate(() => JSON.parse(localStorage.getItem('nivo.workspace.v1')!));
      return (await (await page.request.get('http://127.0.0.1:8787/api/workspace')).json())
        .workspace;
    }
    async function reload(page: Page) {
      await page.reload();
      if (mode === 'Local') await button(page, 'Explore the local demo').click();
    }
    async function restore(page: Page, w: Workspace) {
      await go(page, 'settings');
      await page.getByLabel('Restore a backup', { exact: true }).setInputFiles({
        name: 'synthetic.json',
        mimeType: 'application/json',
        buffer: Buffer.from(
          JSON.stringify({ format: 'nivo-backup-v1', workspace: w, workbooks: {} }),
        ),
      });
      await button(page, 'Restore workspace').click();
      await expect.poll(async () => JSON.stringify(await saved(page))).toBe(JSON.stringify(w));
    }

    test('project and pricing dialogs wrap keyboard focus and cancel without data changes', async ({
      page,
    }) => {
      await go(page, 'boq');
      const before = (await saved(page)).projects[0];
      for (const name of ['Project details', 'Pricing settings']) {
        const trigger = button(page, name);
        await trigger.click();
        await trap(page);
        const dialog = page.getByRole('dialog');
        const first = dialog.getByRole('button', { name: 'Close dialog' });
        const last = dialog.getByRole('button', {
          name: name === 'Project details' ? 'Save project details' : 'Save pricing',
        });
        await last.focus();
        await page.keyboard.press('Tab');
        await expect(first).toBeFocused();
        await page.keyboard.press('Shift+Tab');
        await expect(last).toBeFocused();
        await close(page);
        await expect(trigger).toBeFocused();
      }
      expect((await saved(page)).projects[0]).toEqual(before);
      verified('DLG-01 DLG-10 CTL-22 CTL-23');
    });

    test('empty states, undated deadlines and enquiry limits', async ({ page }) => {
      workspace.projects[0].dueDate = '';
      await restore(page, workspace);
      await go(page, 'overview');
      await expect(page.locator('.deadline-note')).toContainText('Atlas Office');
      verified('SCR-01');
      workspace.projects[0].items = Array.from({ length: 21 }, (_, i) => ({
        ...workspace.projects[0].items[5],
        id: `limit-${i}`,
        description: `Synthetic line ${i}`,
      }));
      await restore(page, workspace);
      await go(page, 'enquiries');
      await button(page, 'Prepare enquiry').click();
      await expect(page.locator('.select-item input:checked')).toHaveCount(21);
      await expect(page.getByRole('dialog')).toContainText('Voice calls support up to 20 items');
      await page.locator('.select-item input').last().uncheck();
      await expect(page.locator('.select-item input:checked')).toHaveCount(20);
      await expect(page.getByRole('dialog')).not.toContainText(
        'Voice calls support up to 20 items',
      );
      await close(page);
      verified('CTL-48 VOI-06');
      workspace.projects = [];
      workspace.vendors = [];
      workspace.rates = [];
      workspace.enquiries = [];
      await restore(page, workspace);
      await go(page, 'boq');
      await button(page, 'New project').click();
      await expect(page.getByLabel('Project name')).toBeVisible();
      await close(page);
      verified('CTL-18');
      await go(page, 'overview');
      await button(page, 'Create a project').click();
      await expect(page.getByLabel('Project name')).toBeVisible();
      await close(page);
      verified('CTL-91');
      await go(page, 'enquiries');
      await expect(button(page, 'Prepare enquiry')).toBeDisabled();
      workspace.projects = seedWorkspace().projects;
      await restore(page, workspace);
      await go(page, 'enquiries');
      await expect(button(page, 'Prepare enquiry')).toBeDisabled();
      verified('CTL-43');
      workspace.vendors = seedWorkspace().vendors;
      workspace.projects[0].items = [];
      await restore(page, workspace);
      await go(page, 'boq');
      await button(page, 'Add first item').click();
      await expect(page.getByLabel('Item description')).toBeVisible();
      await close(page);
      verified('CTL-32');
    });

    test('approval and stale-source gates, metadata resets and mobile item actions', async ({
      page,
    }) => {
      workspace.projects[0].items = [
        { ...workspace.projects[0].items[0], cost: 100, reviewed: true },
      ];
      workspace.projects[0].stage = 'Approved';
      await restore(page, workspace);
      await go(page, 'boq');
      const unchanged = (await saved(page)).projects[0];
      await button(page, 'Pricing settings').click();
      await page.getByLabel('Markup on cost (%)', { exact: true }).fill('30');
      await close(page);
      expect((await saved(page)).projects[0]).toEqual(unchanged);
      await button(page, 'Project details').click();
      await button(page, 'Save project details').click();
      await expect.poll(async () => (await saved(page)).projects[0].stage).toBe('Draft');
      expect((await saved(page)).projects[0].items[0].reviewed).toBe(false);
      verified('CTL-59');
      await button(page, 'Review').click();
      await button(page, 'Approve reviewed BOQ').click();
      await expect.poll(async () => (await saved(page)).projects[0].stage).toBe('Approved');
      workspace.projects[0].items[0].rateId = 'r5';
      await restore(page, workspace);
      await go(page, 'boq');
      await expect(button(page, 'Approve reviewed BOQ')).toBeDisabled();
      await button(page, 'Reviewed').click();
      await button(page, 'Review').click();
      await expect(page.locator('.toast')).toContainText('expired');
      workspace.projects[0].items[0].quantity = null;
      workspace.projects[0].items[0].quantityKind = 'unknown';
      await restore(page, workspace);
      await go(page, 'boq');
      await expect(button(page, 'Approve reviewed BOQ')).toBeDisabled();
      workspace.projects[0].items = [];
      await restore(page, workspace);
      await go(page, 'boq');
      await expect(button(page, 'Approve reviewed BOQ')).toBeDisabled();
      verified('CTL-34 INV-04 INV-12');
      workspace = seedWorkspace();
      workspace.projects[0].items[0].context = [
        { row: 7, text: 'Synthetic inherited specification' },
      ];
      await restore(page, workspace);
      await go(page, 'boq');
      await button(page, 'BWP plywood, 18 mm').click();
      await page.getByText(/Inherited specification ·/).click();
      await expect(page.getByRole('dialog')).toContainText('Row 7');
      await expect(page.getByRole('dialog')).toContainText('Synthetic inherited specification');
      await close(page);
      verified('CTL-117');
      await button(page, 'LED downlight, 12 W').click();
      await page.getByLabel('Item description').fill('Discarded edit');
      await button(page, 'Cancel').click();
      await expect(button(page, 'LED downlight, 12 W')).toBeVisible();
      verified('DLG-03 CTL-60');
      await page.setViewportSize({ width: 390, height: 844 });
      const mobile = page.locator('.mobile-boq-item').filter({ hasText: 'LED downlight' });
      await mobile.getByRole('button', { name: 'Edit LED downlight, 12 W', exact: true }).click();
      await close(page);
      await mobile.getByRole('button', { name: 'LED downlight, 12 W', exact: true }).click();
      await close(page);
      await mobile.getByRole('button', { name: 'Find rate' }).click();
      await page.getByRole('checkbox').check();
      await button(page, 'Apply rate').click();
      await mobile.getByRole('button', { name: 'Review', exact: true }).click();
      await mobile.getByRole('button', { name: 'Reviewed', exact: true }).click();
      await mobile.getByRole('button', { name: '₹680.00', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Choose a rate' })).toBeVisible();
      await close(page);
      await mobile.getByRole('button', { name: 'Delete LED downlight, 12 W' }).click();
      await button(page, 'Keep item').click();
      verified('CTL-28 CTL-29 CTL-30 CTL-31');
      await page.screenshot({ path: `data/audit-ui/${mode}-boq-phone.png`, fullPage: true });
      await page.setViewportSize({ width: 1440, height: 1100 });
      await button(page, 'Prepare a vendor enquiry').click();
      await expect(page.locator('main h1')).toHaveText('The enquiry desk');
      verified('CTL-33');
      await go(page, 'boq');
      await page
        .locator('.boq-table tbody tr')
        .filter({ hasText: 'Bathroom vanity' })
        .getByRole('button', { name: 'Find rate' })
        .click();
      await button(page, 'Prepare enquiry').click();
      await expect(page.locator('main h1')).toHaveText('The enquiry desk');
      verified('CTL-38');
    });

    test('workbook mapping, import gates, all exports and retained bytes in backup', async ({
      page,
    }) => {
      const book = new ExcelJS.Workbook();
      const sheet = book.addWorksheet('Client');
      sheet.addRow([
        'Reference',
        'Description',
        'Specification',
        'Unit',
        'Quantity',
        'Rate',
        'Amount',
      ]);
      sheet.addRow(['A1', 'Audit cable', 'Supply only', 'm', 10, 100, null]);
      sheet.addRow(['A2', 'Audit switch', 'Supply only', 'nos', 2, 0, null]);
      const bytes = Buffer.from(await book.xlsx.writeBuffer());
      await go(page, 'boq');
      await button(page, 'Import Excel').click();
      await page
        .getByLabel('Choose Excel workbook')
        .setInputFiles({ name: 'bad.csv', mimeType: 'text/csv', buffer: Buffer.from('bad') });
      await expect(page.getByRole('dialog')).toContainText('.xlsx');
      await page
        .getByLabel('Choose Excel workbook')
        .setInputFiles({ name: 'audit.xlsx', mimeType: 'application/octet-stream', buffer: bytes });
      await expect(button(page, 'Import 2 items')).toBeDisabled();
      for (const [label, col] of [
        ['Description', '2'],
        ['Original reference', '1'],
        ['Specification', '3'],
        ['Unit', '4'],
        ['Quantity', '5'],
      ])
        await page.getByRole('combobox', { name: label, exact: true }).selectOption(col);
      await page.getByRole('combobox', { name: 'Rate column', exact: true }).selectOption('');
      await expect(page.getByRole('checkbox', { name: /Import existing rate/ })).toBeDisabled();
      await page.getByRole('combobox', { name: 'Rate column', exact: true }).selectOption('6');
      await page.getByRole('checkbox', { name: /Import existing rate/ }).check();
      await page.getByRole('combobox', { name: 'Amount column', exact: true }).selectOption('7');
      await page.getByRole('checkbox', { name: /I have checked/ }).check();
      await page.getByRole('combobox', { name: 'Unit', exact: true }).selectOption('2');
      await expect(button(page, 'Import 2 items')).toBeDisabled();
      await page.getByRole('combobox', { name: 'Unit', exact: true }).selectOption('4');
      await button(page, 'Cancel').click();
      expect((await saved(page)).projects[0].items).toHaveLength(8);
      verified('CTL-68');
      await button(page, 'Import Excel').click();
      await page
        .getByLabel('Choose Excel workbook')
        .setInputFiles({ name: 'audit.xlsx', mimeType: 'application/octet-stream', buffer: bytes });
      for (const [label, col] of [
        ['Description', '2'],
        ['Original reference', '1'],
        ['Specification', '3'],
        ['Unit', '4'],
        ['Quantity', '5'],
      ])
        await page.getByRole('combobox', { name: label, exact: true }).selectOption(col);
      await page.getByRole('combobox', { name: 'Rate column', exact: true }).selectOption('6');
      await page.getByRole('combobox', { name: 'Amount column', exact: true }).selectOption('7');
      await page.getByRole('checkbox', { name: /Import existing rate/ }).check();
      await page.getByRole('checkbox', { name: /I have checked/ }).check();
      await button(page, 'Import 2 items').click();
      await expect.poll(async () => (await saved(page)).projects[0].items.length).toBe(2);
      expect((await saved(page)).projects[0].items[0].cost).toBe(100);
      expect((await saved(page)).projects[0].items[1].cost).toBeNull();
      verified('CTL-19 CTL-65 CTL-66 CTL-67 CTL-69 DLG-05');
      for (const name of [
        /Client quotation/,
        /Fill the original workbook/,
        /Internal costing workbook/,
      ]) {
        await button(page, 'Export BOQ').click();
        const downloading = page.waitForEvent('download');
        await button(page, name).click();
        const dl = await downloading;
        const result = new ExcelJS.Workbook();
        await result.xlsx.readFile((await dl.path())!);
        expect(result.worksheets.length).toBeGreaterThan(0);
        if (name.source.startsWith('Fill'))
          expect(result.getWorksheet('Client')!.getCell('F2').value).toBe(120);
      }
      verified('CTL-20 CTL-41 DLG-06');
      await go(page, 'settings');
      const downloading = page.waitForEvent('download');
      await button(page, 'Export full backup').click();
      const dl = await downloading;
      const backup = JSON.parse(readFileSync((await dl.path())!, 'utf8'));
      expect(Buffer.from(Object.values(backup.workbooks)[0] as string, 'base64')).toEqual(bytes);
      await button(page, 'Start an empty workspace').click();
      await button(page, 'Start empty').click();
      await page.getByLabel('Restore a backup', { exact: true }).setInputFiles((await dl.path())!);
      await button(page, 'Restore workspace').click();
      await expect.poll(async () => (await saved(page)).projects[0]?.items.length).toBe(2);
      await go(page, 'boq');
      await button(page, 'Export BOQ').click();
      await expect(button(page, /Fill the original workbook/)).toBeEnabled();
      await close(page);
      verified('BAK-03');
    });

    test('navigation, command search and mobile keyboard boundaries', async ({ page }) => {
      await page.getByRole('link', { name: 'Skip to content' }).focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('#main-content')).toBeFocused();
      verified('CTL-01');
      for (const [label, path] of [
        ['Projects 3', 'projects'],
        ['BOQ workbench', 'boq'],
        ['Rate library', 'rates'],
        ['Vendors', 'vendors'],
        ['Enquiry desk', 'enquiries'],
        ['Overview', 'overview'],
      ]) {
        await page.locator('nav').getByRole('button', { name: label, exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`#${path}$`));
        await expect(page.locator('nav button[aria-current="page"]')).toContainText(
          label.replace(' 3', ''),
        );
      }
      verified('CTL-04');
      await button(page, 'Settings & data').click();
      await expect(page).toHaveURL(/#settings$/);
      verified('CTL-05');
      for (const label of ['Privacy', 'Terms of use']) {
        await button(page, label).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await close(page);
      }
      verified('CTL-06 CTL-07');
      await button(page, 'Manage data').click();
      await expect(page).toHaveURL(/#settings$/);
      verified('CTL-11');
      await button(page, 'Nivo overview').click();
      await expect(page).toHaveURL(/#overview$/);
      verified('CTL-03');
      for (const [q, destination] of [
        ['Projects', 'projects'],
        ['Atlas', 'boq'],
        ['LED', 'rates'],
        ['Lumen', 'vendors'],
      ]) {
        await button(page, /Jump to anything/).click();
        const input = page.getByLabel('Search workspace');
        await expect(input).toBeFocused();
        await expect(input).toHaveValue('');
        await input.fill(q);
        await page.locator('.command-results button').first().click();
        await expect(page).toHaveURL(new RegExp(`#${destination}$`));
        await expect(page.getByRole('dialog')).toHaveCount(0);
        if (q === 'Atlas') await expect(page.locator('main h1')).toHaveText('Atlas Office');
      }
      await page.keyboard.press('Control+k');
      await expect(page.getByLabel('Search workspace')).toBeVisible();
      await page.getByLabel('Search workspace').fill('Mehra');
      await expect(page.locator('.command-results button')).toHaveCount(0);
      await close(page);
      verified('CTL-09 CTL-13 CTL-14 CTL-15 CTL-16 CTL-17');
      await page.setViewportSize({ width: 390, height: 844 });
      const menu = button(page, 'Open navigation');
      await expect(page.locator('.sidebar')).toHaveAttribute('inert', '');
      await menu.click();
      await expect(menu).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('.sidebar')).toHaveAttribute('role', 'dialog');
      await expect(page.locator('.sidebar')).toHaveAttribute('aria-modal', 'true');
      expect(await page.evaluate(() => !!document.activeElement?.closest('.sidebar'))).toBe(true);
      expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
      await trap(page);
      await page.keyboard.press('Escape');
      await expect(menu).toBeFocused();
      await expect(menu).toHaveAttribute('aria-expanded', 'false');
      expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
      await menu.click();
      await button(page, 'Close navigation').click({ position: { x: 380, y: 300 } });
      await expect(menu).toHaveAttribute('aria-expanded', 'false');
      verified('CTL-02 CTL-08 CTL-119 CTL-120 CTL-121 CTL-122 CTL-123');
      await page.screenshot({ path: `data/audit-ui/${mode}-phone.png`, fullPage: true });
      await page.setViewportSize({ width: 1440, height: 1100 });
      await go(page, 'unknown');
      await expect(page.locator('main h1')).toHaveText('Your studio, in focus.');
      verified('SCR-08');
    });

    test('overview, project, rate and vendor list filters and actions', async ({ page }) => {
      const search = page.getByPlaceholder('Find a project, client or location');
      for (const q of ['aranya', 'MEHRA', 'dlf']) {
        await search.fill(q);
        await expect(page.locator('.project-row')).toHaveCount(1);
      }
      await search.fill('absent');
      await expect(page.locator('.project-row')).toHaveCount(0);
      await expect(button(page, 'Create a project')).toHaveCount(0);
      await search.fill('');
      await expect(page.locator('.project-row')).toHaveCount(3);
      verified('CTL-90');
      await page.locator('.project-row').nth(1).click();
      await expect(page.locator('main h1')).toHaveText('Atlas Office');
      verified('CTL-97');
      for (const [index, path] of [
        [0, 'boq'],
        [1, 'boq'],
        [2, 'rates'],
      ] as const) {
        await go(page, 'overview');
        await page.locator('.attention-row').nth(index).click();
        await expect(page).toHaveURL(new RegExp(`#${path}$`));
      }
      verified('CTL-92 CTL-93 CTL-94');
      await go(page, 'overview');
      await page.locator('.deadline-note button').click();
      await expect(page.locator('main h1')).toHaveText(workspace.projects[0].name);
      verified('CTL-96');
      await go(page, 'overview');
      await button(page, 'Open enquiry desk').click();
      await expect(page).toHaveURL(/#enquiries$/);
      verified('CTL-95');
      await go(page, 'projects');
      for (const q of ['aranya', 'MEHRA', 'dlf']) {
        await page.getByPlaceholder('Search projects').fill(q);
        await expect(page.locator('.project-row')).toHaveCount(1);
      }
      await page.getByLabel('Filter project stage').selectOption('Draft');
      await expect(page.locator('.project-row')).toHaveCount(0);
      await page.getByPlaceholder('Search projects').fill('');
      await expect(page.locator('.project-row')).toHaveCount(2);
      await page.getByLabel('Filter project stage').selectOption('Approved');
      await page.locator('.empty button').click();
      await expect(page.getByLabel('Project name')).toBeVisible();
      await close(page);
      verified('CTL-99 CTL-100 CTL-101 SCR-02');
      await go(page, 'rates');
      await expect(page.locator('.library-intro')).toContainText('1 need refreshing');
      for (const q of ['LED', 'recessed', 'LE-042']) {
        await page.getByPlaceholder('Search materials, specifications or sources').fill(q);
        await expect(page.locator('.rates-table tbody tr')).toHaveCount(1);
      }
      await page.getByLabel('Filter rate category').selectOption('Joinery');
      await expect(page.locator('.rates-table tbody tr')).toHaveCount(0);
      await page.getByLabel('Filter rate category').selectOption('Electrical');
      for (const label of ['LED downlight, 12 W', 'View LED downlight, 12 W']) {
        await button(page, label).click();
        await expect(page.getByRole('dialog')).toContainText('Sample quotation LE-042');
        await close(page);
      }
      verified('CTL-103 CTL-104 CTL-105 SCR-04');
      await go(page, 'vendors');
      for (const q of ['LUMEN', 'rajiv', 'Electrical', 'bhagirath']) {
        await page.getByPlaceholder('Search vendors, trades or locations').fill(q);
        await expect(page.locator('.vendor-row')).toHaveCount(1);
      }
      await page.locator('.vendor-row').click();
      await expect(page.getByRole('dialog')).toContainText('Rajiv Kapoor');
      await button(page, 'Edit vendor').click();
      await expect(page.getByRole('dialog')).toHaveCount(1);
      await expect(page.getByLabel('Company name')).toHaveValue('Lumen Electricals');
      await button(page, 'Cancel').click();
      verified('CTL-107 CTL-108 CTL-110');
      await page.getByPlaceholder('Search vendors, trades or locations').fill('absent');
      await button(page, 'Add a vendor').click();
      await expect(page.getByLabel('Company name')).toBeVisible();
      await close(page);
      verified('CTL-109');
    });

    test('BOQ filters combine without stale rows and distinguish zero from null', async ({
      page,
    }) => {
      await go(page, 'boq');
      const rows = page.locator('.boq-table tbody tr');
      await expect(rows).toHaveCount(8);
      await page.getByLabel('Filter by category').selectOption('Joinery');
      await expect(rows).toHaveCount(3);
      await button(page, 'Needs review').click();
      await expect(rows).toHaveCount(1);
      await page.getByPlaceholder('Find an item or specification').fill('LABOUR');
      await expect(rows).toHaveCount(1);
      await page.getByPlaceholder('Find an item or specification').fill('absent');
      await expect(rows).toHaveCount(0);
      await page.getByPlaceholder('Find an item or specification').fill('');
      await page.getByLabel('Filter by category').selectOption('All items');
      await expect(rows).toHaveCount(5);
      await page
        .locator('.tabs')
        .getByRole('button', { name: /^Unpriced/ })
        .click();
      await expect(rows).toHaveCount(3);
      await expect(page.locator('.table-footer')).toContainText('3 of 8');
      await page.getByLabel('Choose project').selectOption('p2');
      await expect(rows).toHaveCount(1);
      await expect(rows).toContainText('Meeting table');
      await button(page, 'All').click();
      await expect(rows).toHaveCount(3);
      await page.getByLabel('Choose project').selectOption('p1');
      await button(page, 'Edit LED downlight, 12 W').click();
      await page.getByLabel('Unit cost (₹, before GST)').fill('0');
      await button(page, 'Save item').click();
      await page
        .locator('.tabs')
        .getByRole('button', { name: /^Unpriced/ })
        .click();
      await expect(rows).toHaveCount(2);
      await expect(rows.filter({ hasText: 'LED' })).toHaveCount(0);
      await expect.poll(async () => (await saved(page)).projects[0].items[5].cost).toBe(0);
      verified(
        'FLT-01 FLT-02 FLT-03 FLT-04 FLT-05 FLT-06 FLT-07 FLT-08 CTL-21 CTL-24 CTL-26 CTL-27 CTL-80',
      );
      await page.getByLabel('Choose project').selectOption('p2');
      await reload(page);
      await expect(page.getByLabel('Choose project')).toHaveValue('p1');
      verified('SCR-03');
    });

    test('project creation, cancellation, pricing and delete confirmations persist', async ({
      page,
    }) => {
      const trigger = button(page, 'New project');
      await trigger.click();
      await expect(page.getByLabel('Project name')).toBeFocused();
      await close(page);
      await expect(trigger).toBeFocused();
      verified('CTL-89');
      await go(page, 'projects');
      await button(page, 'New project').click();
      await button(page, 'Create project').click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByLabel('Project name').fill('Audit project');
      await page.getByLabel('Client', { exact: true }).fill('Fictional client');
      await page.getByLabel('Location', { exact: true }).fill('Audit city');
      await page.getByLabel('Target date').fill('');
      await button(page, 'Create project').click();
      await expect(page.locator('main h1')).toHaveText('Audit project');
      await expect.poll(async () => (await saved(page)).projects[0].name).toBe('Audit project');
      verified('CTL-98');
      await button(page, 'Project details').click();
      await page.getByLabel('Project name').fill('Discard me');
      await button(page, 'Cancel').click();
      await expect(page.locator('main h1')).toHaveText('Audit project');
      await button(page, 'Pricing settings').click();
      await page.getByLabel('Markup on cost (%)', { exact: true }).fill('501');
      await button(page, 'Save pricing').click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByLabel('Markup on cost (%)', { exact: true }).fill('25');
      await page.getByLabel('GST on selling subtotal (%)').fill('101');
      await button(page, 'Save pricing').click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByLabel('GST on selling subtotal (%)').fill('5');
      await close(page);
      expect((await saved(page)).projects[0].markup).toBe(20);
      verified('CTL-23 CTL-39');
      await button(page, 'Project details').click();
      await button(page, 'Delete project').click();
      await button(page, 'Keep project').click();
      await expect(page.locator('main h1')).toHaveText('Audit project');
      await button(page, 'Project details').click();
      await button(page, 'Delete project').click();
      await button(page, 'Delete project').click();
      await expect(page.locator('main h1')).toHaveText('Projects');
      await expect.poll(async () => (await saved(page)).projects.length).toBe(3);
      verified('DLG-02 CTL-22 CTL-35');
      await button(page, 'Dismiss notification').click();
      await expect(page.locator('.toast')).toHaveCount(0);
      verified('CTL-12');
    });

    test('item and assembly editing, review and approval gates', async ({ page }) => {
      await go(page, 'boq');
      const row = page.locator('.boq-table tbody tr').filter({ hasText: 'LED downlight' });
      await expect(row.getByRole('button', { name: 'Unpriced', exact: true })).toBeDisabled();
      await row.getByRole('button', { name: 'Find rate' }).click();
      const apply = button(page, 'Apply rate');
      await expect(apply).toBeDisabled();
      await page.getByRole('checkbox').check();
      await expect(apply).toBeEnabled();
      await apply.click();
      await expect(row).toContainText('₹680.00');
      await expect.poll(async () => (await saved(page)).projects[0].items[5].rateId).toBe('r4');
      await row.getByRole('button', { name: 'Review', exact: true }).click();
      await expect(row.getByRole('button', { name: 'Reviewed', exact: true })).toBeVisible();
      verified('DLG-04 CTL-36');
      await button(page, 'Edit LED downlight, 12 W').click();
      await button(page, 'Save item').click();
      await expect
        .poll(async () => (await saved(page)).projects[0].items[5].rateId ?? null)
        .toBe(null);
      verified('CTL-111');
      await page
        .locator('.boq-table tbody tr')
        .filter({ hasText: 'Soft-close' })
        .getByRole('button', { name: 'Find rate' })
        .click();
      await page.getByRole('checkbox').check();
      await expect(button(page, 'Apply rate')).toBeDisabled();
      await button(page, 'Enter cost manually').click();
      await expect(page.getByLabel('Item description')).toHaveValue('Soft-close drawer channel');
      await close(page);
      verified('CTL-37');
      await button(page, 'Add item').click();
      await page.getByLabel('Item description').fill('Assembly audit');
      await page.getByLabel('Quantity', { exact: true }).fill('2');
      await page.getByLabel('Unit cost (₹, before GST)').fill('999');
      await expect(page.getByLabel('Material per unit (₹)')).not.toBeVisible();
      await page.getByText('Cost breakdown & item markup', { exact: true }).click();
      await page.getByRole('checkbox').check();
      for (const [label, value] of [
        ['Material per unit (₹)', '100'],
        ['Labour per unit (₹)', '50'],
        ['Other per unit (₹)', '10'],
        ['Adjustment on base cost (%)', '10'],
        ['Item markup (%)', '0'],
      ])
        await page.getByLabel(label).fill(value);
      await button(page, 'Save item').click();
      await expect.poll(async () => (await saved(page)).projects[0].items.at(-1)?.cost).toBe(176);
      expect((await saved(page)).projects[0].items.at(-1)?.markupOverride).toBe(0);
      verified('CTL-25 CTL-61 CTL-113 CTL-115 DLG-07');
      await button(page, 'Edit Assembly audit').click();
      await page.getByLabel('Quantity', { exact: true }).fill('');
      await button(page, 'Save item').click();
      await expect
        .poll(async () => (await saved(page)).projects[0].items.at(-1)?.quantityKind)
        .toBe('unknown');
      await expect(
        page
          .locator('.boq-table tbody tr')
          .filter({ hasText: 'Assembly audit' })
          .getByRole('button', { name: 'Review', exact: true }),
      ).toBeDisabled();
      await expect(button(page, 'Approve reviewed BOQ')).toBeDisabled();
      verified('CTL-112');
      await button(page, 'Pricing settings').click();
      await page.getByLabel('Markup on cost (%)', { exact: true }).fill('30');
      await button(page, 'Save pricing').click();
      await expect
        .poll(async () => (await saved(page)).projects[0].items.filter((i) => i.reviewed).length)
        .toBe(0);
      expect((await saved(page)).projects[0].stage).toBe('Draft');
      verified('CTL-40 INV-11');
      await button(page, 'Delete Assembly audit').click();
      await button(page, 'Keep item').click();
      await expect(button(page, 'Assembly audit')).toBeVisible();
      await button(page, 'Delete Assembly audit').click();
      await button(page, 'Remove item').click();
      await expect(button(page, 'Assembly audit')).toHaveCount(0);
      verified('CTL-42 DLG-08');
    });

    test('vendor create edit cancel and rate validation preserve evidence', async ({ page }) => {
      await go(page, 'vendors');
      await button(page, 'Add vendor').click();
      await page.getByLabel('Company name').fill('Fictional audit vendor');
      await page.getByLabel('Contact person').fill('Test contact');
      await page.getByRole('combobox', { name: /^Category/ }).selectOption('Electrical');
      await page.getByLabel('Location', { exact: true }).fill('Test city');
      await page.getByRole('textbox', { name: /^Notes/ }).fill('Synthetic only');
      await button(page, 'Save vendor').click();
      await expect
        .poll(async () => (await saved(page)).vendors.at(-1)?.name)
        .toBe('Fictional audit vendor');
      await page.locator('.vendor-row').filter({ hasText: 'Fictional audit vendor' }).click();
      await button(page, 'Edit vendor').click();
      await page.getByLabel('Company name').fill('Discarded');
      await button(page, 'Cancel').click();
      await page.locator('.vendor-row').filter({ hasText: 'Fictional audit vendor' }).click();
      await button(page, 'Edit vendor').click();
      await page.getByRole('textbox', { name: /^Notes/ }).fill('Updated evidence');
      await button(page, 'Save vendor').click();
      await expect
        .poll(async () => (await saved(page)).vendors.at(-1)?.notes)
        .toBe('Updated evidence');
      verified('CTL-62 CTL-106 SCR-05');
      await go(page, 'rates');
      await button(page, 'Record quotation').click();
      await page.getByLabel('Item description').fill('Audit cable');
      await page.getByLabel('Exact specification').fill('Supply only test');
      await page.getByLabel('Unit cost (₹)', { exact: true }).fill('125');
      await page.getByLabel('Source reference').fill('TEST-001');
      await page.getByLabel('Delivery location').fill('Test city');
      await page.getByLabel('Commercial terms').fill('Supply only, excluding GST');
      await page.getByLabel('Valid until').fill('2000-01-01');
      await button(page, 'Save quotation').click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('dialog')).toContainText(/valid/i);
      await page.getByLabel('Valid until').fill('2099-01-01');
      await button(page, 'Save quotation').click();
      await expect.poll(async () => (await saved(page)).rates[0].sourceRef).toBe('TEST-001');
      await button(page, 'Record quotation').click();
      await page.getByLabel('Item description').fill('Discarded');
      await button(page, 'Cancel').click();
      expect((await saved(page)).rates.length).toBe(6);
      verified('CTL-63 CTL-102');
    });

    test('enquiry selection, brief artifact, notes and quotation lifecycle', async ({
      page,
      context,
    }) => {
      await go(page, 'enquiries');
      await button(page, 'Prepare enquiry').click();
      await expect(page.locator('.select-item input:checked')).toHaveCount(3);
      await page.getByRole('combobox', { name: /^Project/ }).selectOption('p2');
      await expect(page.locator('.select-item input:checked')).toHaveCount(0);
      await expect(button(page, 'Prepare brief')).toBeDisabled();
      await page.getByRole('combobox', { name: /^Vendor/ }).selectOption('v3');
      await page.locator('.select-item input').first().check();
      await page.getByLabel('Additional instructions').fill('Synthetic instruction');
      await button(page, 'Cancel').click();
      expect((await saved(page)).enquiries).toHaveLength(0);
      verified('CTL-46 CTL-47 CTL-49 CTL-50');
      await button(page, 'Prepare first enquiry').click();
      await page.getByRole('combobox', { name: /^Project/ }).selectOption('p1');
      await page
        .locator('.select-item')
        .filter({ hasText: 'LED downlight' })
        .getByRole('checkbox')
        .check();
      await page.getByRole('combobox', { name: /^Vendor/ }).selectOption('v3');
      await button(page, 'Prepare brief').click();
      await expect.poll(async () => (await saved(page)).enquiries[0]?.status).toBe('Prepared');
      verified('CTL-45 CTL-51');
      await page.getByText('Read the complete enquiry brief', { exact: true }).click();
      const brief = await page.locator('.brief-preview').innerText();
      expect(brief).toContain('LED downlight');
      const download = page.waitForEvent('download');
      await button(page, 'Download brief').click();
      const file = await download;
      expect(readFileSync((await file.path())!, 'utf8')).toBe(brief);
      verified('CTL-52 CTL-114');
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await button(page, 'Copy brief').click();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(brief);
      await page.evaluate(() => {
        Object.defineProperty(navigator.clipboard, 'writeText', {
          value: async () => {
            throw new Error('audit denial');
          },
        });
      });
      await button(page, 'Copy brief').click();
      await expect(page.locator('.toast')).toContainText('Clipboard unavailable');
      verified('CTL-53');
      await page.getByRole('textbox', { name: /^Enquiry notes/ }).fill('Audit notes');
      await page.getByLabel('Transcript or conversation notes').fill('Manual audit evidence');
      await button(page, 'Save notes').click();
      await expect
        .poll(async () => (await saved(page)).enquiries[0].transcript)
        .toBe('Manual audit evidence');
      await button(page, 'I have contacted the vendor').click();
      await expect.poll(async () => (await saved(page)).enquiries[0].status).toBe('Awaiting quote');
      verified('CTL-55 CTL-56 CTL-57 CTL-58');
      await button(page, 'Record quotation').first().click();
      await expect(page.getByRole('dialog')).toHaveCount(1);
      await expect(page.getByLabel('Item description')).toHaveValue('LED downlight, 12 W');
      await page.getByLabel('Unit cost (₹)', { exact: true }).fill('725');
      await page.getByLabel('Source reference').fill('AUDIT-ENQUIRY');
      await page.getByLabel('Delivery location').fill('Test city');
      await page.getByLabel('Commercial terms').fill('Supply only, excluding GST');
      await button(page, 'Save quotation').click();
      await expect(button(page, 'Update quotation')).toBeVisible();
      await expect.poll(async () => (await saved(page)).enquiries[0].status).toBe('Quote received');
      expect((await saved(page)).projects[0].items[5].cost).toBeNull();
      verified('CTL-54 DLG-09');
      await close(page);
      await page.locator('.enquiry-row').click();
      await expect(page.getByRole('textbox', { name: /^Enquiry notes/ })).toHaveValue(
        'Audit notes',
      );
      verified('CTL-44');
    });

    test('settings backup reset cancel restore and reload', async ({ page }) => {
      await go(page, 'settings');
      await page.getByLabel('Studio name').fill('Audit saved studio');
      await page.getByLabel('Default location').fill('Audit city');
      await page.getByLabel('Default markup on cost (%)').fill('25');
      await page.getByLabel('Default GST (%)').fill('12');
      await button(page, 'Save studio details').click();
      await expect.poll(async () => (await saved(page)).settings.defaultMarkup).toBe(25);
      await reload(page);
      await expect(page.getByLabel('Studio name')).toHaveValue('Audit saved studio');
      verified('CTL-71');
      const download = page.waitForEvent('download');
      await button(page, 'Export full backup').click();
      const file = await download;
      const backup = JSON.parse(readFileSync((await file.path())!, 'utf8'));
      expect(backup.workspace).toEqual(await saved(page));
      verified('CTL-72');
      await button(page, 'Start an empty workspace').click();
      await button(page, 'Keep my workspace').click();
      expect((await saved(page)).projects).toHaveLength(3);
      await button(page, 'Start an empty workspace').click();
      await button(page, 'Start empty').click();
      await expect.poll(async () => (await saved(page)).projects.length).toBe(0);
      expect((await saved(page)).settings.company).toBe('Audit saved studio');
      verified('CTL-74 CTL-75');
      await page.getByLabel('Restore a backup', { exact: true }).setInputFiles({
        name: 'bad.json',
        mimeType: 'application/json',
        buffer: Buffer.from('{}'),
      });
      await expect(page.locator('.toast')).toContainText(/backup|workspace|format/i);
      expect((await saved(page)).projects).toHaveLength(0);
      await page
        .getByLabel('Restore a backup', { exact: true })
        .setInputFiles((await file.path())!);
      await expect(page.getByRole('dialog')).toBeVisible();
      expect((await saved(page)).projects).toHaveLength(0);
      await button(page, 'Cancel').click();
      expect((await saved(page)).projects).toHaveLength(0);
      await page
        .getByLabel('Restore a backup', { exact: true })
        .setInputFiles((await file.path())!);
      await button(page, 'Restore workspace').click();
      await expect.poll(async () => (await saved(page)).projects.length).toBe(3);
      expect(await saved(page)).toEqual(backup.workspace);
      verified('CTL-73 CTL-76 SCR-07');
      await page.screenshot({ path: `data/audit-ui/${mode}-desktop.png`, fullPage: true });
    });

    test('storage error recovery, pending backup and session exit', async ({ page, context }) => {
      if (mode === 'Local') {
        await page.evaluate(() => localStorage.setItem('nivo.workspace.v1', 'corrupt-audit-data'));
        await reload(page);
        await expect(page.getByRole('alert')).toContainText('has not been overwritten');
        await button(page, 'Open settings').click();
        await expect(page).toHaveURL(/#settings$/);
        expect(await page.evaluate(() => localStorage.getItem('nivo.workspace.v1'))).toBe(
          'corrupt-audit-data',
        );
        await button(page, 'Start an empty workspace').click();
        await button(page, 'Start empty').click();
        await expect(page.getByRole('alert')).toHaveCount(0);
        await button(page, /Connect to studio/).click();
        await expect(page.getByRole('heading', { name: 'Enter your studio' })).toBeVisible();
        verified('CTL-10 CTL-70 CTL-78');
        return;
      }
      const other = await context.newPage();
      await other.goto('/#settings');
      await expect(other.getByLabel('Studio name')).toHaveValue(workspace.settings.company);
      await go(page, 'settings');
      await page.getByLabel('Studio name').fill('Winning first tab');
      await button(page, 'Save studio details').click();
      await expect.poll(async () => (await saved(page)).settings.company).toBe('Winning first tab');
      await other.getByLabel('Studio name').fill('Pending second tab');
      await button(other, 'Save studio details').click();
      await expect(other.getByRole('alert')).toContainText('Another session changed');
      await expect(other.getByLabel('Studio name')).toHaveValue('Pending second tab');
      await button(other, 'Open settings').click();
      const downloading = other.waitForEvent('download');
      await button(other, 'Export full backup').click();
      const dl = await downloading;
      expect(JSON.parse(readFileSync((await dl.path())!, 'utf8')).workspace.settings.company).toBe(
        'Pending second tab',
      );
      expect((await saved(page)).settings.company).toBe('Winning first tab');
      await other.close();
      await page.getByLabel('Studio name').fill('Flush before logout');
      await button(page, 'Save studio details').click();
      await button(page, 'Sign out of studio').click();
      await expect(page.getByRole('heading', { name: 'Enter your studio' })).toBeVisible();
      expect((await page.request.get('http://127.0.0.1:8787/api/workspace')).status()).toBe(401);
      verified('CTL-10 CTL-70');
    });

    test('import rejects limits and warnings disclose only the first thirty', async ({ page }) => {
      await go(page, 'boq');
      const limits: { name: string; buffer: Buffer; message: RegExp }[] = [
        { name: 'bad.xls', buffer: Buffer.from('bad'), message: /Choose an .xlsx/ },
        { name: 'large.xlsx', buffer: Buffer.alloc(10 * 1024 * 1024 + 1), message: /up to 10 MB/ },
      ];
      const empty = new ExcelJS.Workbook();
      limits.push({
        name: 'empty.xlsx',
        buffer: Buffer.from(await empty.xlsx.writeBuffer()),
        message: /no worksheets/,
      });
      for (const [cell, message] of [
        ['A10001', /10,000 rows/],
        ['CW1', /100 columns/],
      ] as const) {
        const b = new ExcelJS.Workbook();
        b.addWorksheet('Limit').getCell(cell).value = 'Limit';
        limits.push({
          name: 'limit.xlsx',
          buffer: Buffer.from(await b.xlsx.writeBuffer()),
          message,
        });
      }
      for (const fixture of limits) {
        await button(page, 'Import Excel').click();
        await page.getByLabel('Choose Excel workbook').setInputFiles({
          name: fixture.name,
          mimeType: 'application/octet-stream',
          buffer: fixture.buffer,
        });
        await expect(page.getByRole('alert')).toContainText(fixture.message);
        await expect(
          page.getByRole('dialog').getByRole('button', { name: /^Import/ }),
        ).toBeDisabled();
        await close(page);
      }
      verified('CTL-64');
      const warnings = new ExcelJS.Workbook();
      const sheet = warnings.addWorksheet('Warnings');
      sheet.addRow(['Description', 'Unit', 'Quantity']);
      for (let i = 0; i < 35; i++) sheet.addRow([`Warning item ${i}`, 'm', null]);
      await button(page, 'Import Excel').click();
      await page.getByLabel('Choose Excel workbook').setInputFiles({
        name: 'warnings.xlsx',
        mimeType: 'application/octet-stream',
        buffer: Buffer.from(await warnings.xlsx.writeBuffer()),
      });
      await page.getByRole('dialog').locator('summary').click();
      await expect(page.getByRole('dialog').locator('details p')).toHaveCount(30);
      await close(page);
      verified('CTL-118');
      await button(page, 'Project details').click();
      await button(page, 'Close dialog').click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await button(page, 'Project details').click();
      await page.mouse.click(5, 5);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      verified('CTL-79');
    });
  });
}
