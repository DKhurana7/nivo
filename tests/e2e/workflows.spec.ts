import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';
test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', (route) => route.abort());
});

test('phone BOQ exposes pricing actions without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#boq');
  const item = page.locator('.mobile-boq-item').filter({ hasText: 'LED downlight' });
  await expect(item.getByText('Selling amount')).toBeVisible();
  await item.getByRole('button', { name: 'Find rate' }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Apply rate', exact: true }).click();
  await expect(item.getByRole('button', { name: '₹680.00' })).toBeVisible();
  await item.getByRole('button', { name: 'Review', exact: true }).click();
  await expect(item.getByRole('button', { name: 'Reviewed', exact: true })).toBeVisible();
});

test('project metadata can be edited and deletion requires confirmation', async ({ page }) => {
  await page.goto('/#boq');
  await page.getByRole('button', { name: 'Project details', exact: true }).click();
  await page.getByLabel('Project name').fill('Updated residence');
  await page.getByRole('button', { name: 'Save project details' }).click();
  await expect(page.getByRole('heading', { name: 'Updated residence' })).toBeVisible();
  await page.getByRole('button', { name: 'Project details', exact: true }).click();
  await page.getByRole('button', { name: 'Delete project', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Delete this project?' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep project' }).click();
  await expect(page.getByRole('heading', { name: 'Updated residence' })).toBeVisible();
  await page.getByRole('button', { name: 'Project details', exact: true }).click();
  await page.getByRole('button', { name: 'Delete project', exact: true }).click();
  await page.getByRole('button', { name: 'Delete project', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Updated residence' })).toHaveCount(0);
});

test('create, price, review, export and reload a BOQ', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await page.getByLabel('Project name').fill('Pilot residence');
  await page.getByLabel('Client', { exact: true }).fill('Pilot client');
  await page.getByRole('button', { name: 'Create project', exact: true }).click();
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  await page.getByLabel('Item description').fill('Test plywood');
  await page.getByLabel('Specification & inclusions').fill('18 mm supply only');
  await page.getByLabel('Quantity', { exact: true }).fill('10');
  await page.getByLabel('Unit cost (₹, before GST)').fill('100');
  await page.getByRole('button', { name: 'Save item' }).click();
  await expect(page.locator('.boq-summary')).toContainText('₹1,200');
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await page.getByRole('button', { name: 'Approve reviewed BOQ' }).click();
  await expect(page.locator('.project-context')).toContainText('Approved');
  await page.getByRole('button', { name: 'Export BOQ', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Client quotation/ }).click();
  await page.getByRole('button', { name: 'Download Excel', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('Pilot residence');
  const path = await download.path();
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(path!);
  expect(book.getWorksheet('BOQ')!.getCell('G5').value).toBe(1200);
  await page.reload();
  await page.getByLabel('Choose project').selectOption({ label: 'Pilot residence' });
  await expect(page.getByRole('button', { name: 'Test plywood', exact: true })).toBeVisible();
});

test('rate selection enforces a specification check and applies source evidence', async ({
  page,
}) => {
  await page.goto('/#boq');
  await page
    .getByRole('row')
    .filter({ hasText: 'LED downlight' })
    .getByRole('button', { name: 'Find rate' })
    .click();
  const apply = page.getByRole('button', { name: 'Apply rate', exact: true });
  await expect(apply).toBeDisabled();
  await page.getByRole('checkbox').check();
  await apply.click();
  const row = page.getByRole('row').filter({ hasText: 'LED downlight' });
  await expect(row).toContainText('₹680.00');
  await expect(row).toContainText('Vendor quote');
  await expect(row.getByRole('button', { name: 'Review', exact: true })).toBeEnabled();
});

test('imports mapped workbook and fills original cells without replacing neighbouring content', async ({
  page,
}) => {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Client');
  sheet.getCell('A1').value = 'Client reference ABC';
  sheet.getCell('A1').font = { bold: true };
  sheet.addRow(['Description', 'Unit', 'Quantity', 'Rate', 'Amount']);
  sheet.addRow(['Imported tile', 'sq ft', 10, null, null]);
  sheet.getCell('G3').value = 'Preserve this note';
  const other = book.addWorksheet('Terms');
  other.getCell('A1').value = 'Original terms';
  await page.goto('/#boq');
  await page.getByRole('button', { name: 'Import Excel' }).click();
  await page.getByLabel('Choose Excel workbook').setInputFiles({
    name: 'client.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(await book.xlsx.writeBuffer()),
  });
  await page.getByLabel('Header row').fill('2');
  await page.getByRole('combobox', { name: 'Rate column', exact: true }).selectOption('4');
  await page.getByRole('combobox', { name: 'Amount column', exact: true }).selectOption('5');
  await page.getByRole('checkbox', { name: /I have checked/ }).check();
  await page.getByRole('button', { name: 'Import 1 items' }).click();
  await expect(page.getByRole('button', { name: 'Imported tile', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit Imported tile', exact: true }).click();
  await page.getByLabel('Unit cost (₹, before GST)').fill('100');
  await page.getByRole('button', { name: 'Save item' }).click();
  await page.getByRole('button', { name: 'Export BOQ' }).click();
  const promise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Fill the original workbook/ }).click();
  await expect(page.getByRole('region', { name: 'Excel preview', exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: /I understand this includes/ }).check();
  await page.getByRole('button', { name: 'Download Excel', exact: true }).click();
  const dl = await promise;
  const output = new ExcelJS.Workbook();
  await output.xlsx.readFile((await dl.path())!);
  expect(output.getWorksheet('Client')!.getCell('D3').value).toBe(120);
  expect(output.getWorksheet('Client')!.getCell('E3').value).toBe(1200);
  expect(output.getWorksheet('Client')!.getCell('G3').value).toBe('Preserve this note');
  expect(output.getWorksheet('Client')!.getCell('A1').font.bold).toBe(true);
  expect(output.getWorksheet('Terms')!.getCell('A1').value).toBe('Original terms');
});

test('prepares enquiry, captures a quote and keeps calling explicitly disconnected', async ({
  page,
}) => {
  await page.goto('/#enquiries');
  await expect(page.getByText('Voice calling / Studio sign-in required')).toBeVisible();
  await page.getByRole('button', { name: 'Prepare enquiry', exact: true }).click();
  await page.getByRole('button', { name: 'Prepare brief', exact: true }).click();
  await page.getByText('Read the complete enquiry brief', { exact: true }).click();
  await expect(page.locator('.brief-preview')).toContainText('LED downlight');
  await page.getByRole('button', { name: 'Record quotation', exact: true }).first().click();
  await page.getByLabel('Unit cost (₹)', { exact: true }).fill('725');
  await page.getByLabel('Source reference').fill('Phone quote 22/09');
  await page.getByLabel('Delivery location').fill('Gurugram');
  await page.getByLabel('Commercial terms').fill('GST and freight extra. Stock available.');
  await page.getByRole('button', { name: 'Save quotation', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Record another offer' })).toBeVisible();
  await page.getByRole('button', { name: 'Record another offer', exact: true }).click();
  await page.getByLabel('Quoted brand / make').fill('Alternative make');
  await page.getByLabel('Quoted model / product code').fill('ALT-12');
  await page.getByLabel('Unit cost (₹)', { exact: true }).fill('750');
  await page.getByLabel('Source reference').fill('Alternative offer');
  await page.getByLabel('Delivery location').fill('Gurugram');
  await page.getByLabel('Commercial terms').fill('Supply only; GST extra');
  await page.getByRole('button', { name: 'Save quotation', exact: true }).click();
  const offers = await page.evaluate(() => JSON.parse(localStorage.getItem('nivo.workspace.v1')!));
  expect(offers.enquiries[0].quotes).toHaveLength(2);
  expect(
    offers.rates.filter((r: { sourceRef: string }) =>
      ['Phone quote 22/09', 'Alternative offer'].includes(r.sourceRef),
    ),
  ).toHaveLength(2);
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.goto('/#rates');
  await expect(page.getByRole('row').filter({ hasText: '₹725.00' })).toContainText('LED downlight');
});

test('backs up and restores data after empty-workspace reset', async ({ page }) => {
  await page.goto('/#settings');
  const promise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export full backup' }).click();
  const backup = await promise;
  await page.getByRole('button', { name: 'Start an empty workspace' }).click();
  await page.getByRole('button', { name: 'Start empty', exact: true }).click();
  await expect(page.locator('.data-counts')).toContainText('0 projects');
  await page.getByLabel('Restore a backup', { exact: true }).setInputFiles((await backup.path())!);
  await page.getByRole('button', { name: 'Restore workspace', exact: true }).click();
  await expect(page.locator('.data-counts')).toContainText('3 projects');
});

test('responsive layouts contain overflow at desktop, tablet and phone sizes', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of [
      'overview',
      'projects',
      'boq',
      'rates',
      'vendors',
      'enquiries',
      'settings',
    ]) {
      await page.goto(`/#${path}`);
      await expect(page.locator('h1').first()).toBeVisible();
      const outside = await page.evaluate(() =>
        [...document.querySelectorAll('body *')]
          .filter(
            (e) => !e.closest('.table-scroll') && e.getBoundingClientRect().right > innerWidth + 1,
          )
          .map((e) => ({
            tag: e.tagName,
            class: e.className,
            right: e.getBoundingClientRect().right,
          }))
          .slice(0, 8),
      );
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
        `${path} overflows at ${width}px: ${JSON.stringify(outside)}`,
      ).toBe(true);
      if ((width === 1440 || width === 390) && (path === 'overview' || path === 'boq'))
        await page.screenshot({
          path: `test-results/${path}-${width}.png`,
          fullPage: true,
          animations: 'disabled',
        });
    }
  }
  expect(errors).toEqual([]);
});

test('mobile navigation and dialog keyboard focus work', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('button', { name: 'Rate library', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Rate library', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Record quotation', exact: true }).click();
  await expect(page.getByLabel('Item description')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Record quotation', exact: true })).toBeFocused();
});
