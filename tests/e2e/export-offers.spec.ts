import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';
import { seedWorkspace } from '../../src/lib/seed';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', (r) => r.abort());
  const w = seedWorkspace();
  w.projects = [
    {
      ...w.projects[0],
      items: [
        {
          ...w.projects[0].items[0],
          cost: null,
          rateId: undefined,
          brand: 'Brand A',
          model: '',
          quantity: 3,
        },
      ],
    },
  ];
  w.rates = [
    { ...w.rates[0], brand: 'Brand A', model: 'A1', cost: 100 },
    { ...w.rates[0], id: 'r-alt', brand: 'Brand B', model: 'B1', vendorId: 'v2', cost: 150 },
  ];
  await page.addInitScript((w) => {
    if (!localStorage.getItem('nivo.workspace.v1'))
      localStorage.setItem('nivo.workspace.v1', JSON.stringify(w));
  }, w);
  await page.goto('/#boq');
});

test('compare brands, retain the selected vendor, preview formulas and download client-safe Excel', async ({
  page,
}) => {
  await page.locator('.boq-table').getByRole('button', { name: 'Find rate' }).click();
  await page.getByPlaceholder('Compare brands, models or vendors').fill('Surface');
  await expect(page.locator('.candidate')).toHaveCount(1);
  await expect(page.locator('.candidate')).toContainText('Brand B / B1');
  await expect(page.locator('.candidate')).toContainText('Different or unspecified brand');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Apply rate', exact: true }).click();
  await page.reload();
  await expect(page.locator('.boq-table')).toContainText('Brand B / B1 / Surface Collective');
  await page.getByRole('button', { name: 'Export BOQ', exact: true }).click();
  await page.getByLabel('Excel calculations').selectOption('formulas');
  await expect(page.getByRole('region', { name: 'Excel preview', exact: true })).toContainText(
    'Brand: Brand B',
  );
  await page.screenshot({ path: 'test-results/export-desktop.png', fullPage: true });
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Excel', exact: true }).click();
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile((await (await downloaded).path())!);
  const s = book.getWorksheet('BOQ')!;
  expect(s.getCell('F5').value).toBe(180);
  expect(s.getCell('G5').result).toBe(540);
  expect(s.getCell('G5').formula).toBe('ROUND(E5*F5,2)');
  expect(JSON.stringify(s.model)).not.toContain('Surface Collective');
  expect(s.getCell('C5').text).toContain('Model: B1');
  // Editing unrelated markup preserves evidence; changing price detaches it.
  await page.getByRole('button', { name: 'Edit BWP plywood, 18 mm', exact: true }).click();
  await page.getByRole('button', { name: 'Save item', exact: true }).click();
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('nivo.workspace.v1')!));
  expect((await saved()).projects[0].items[0].rateId).toBe('r-alt');
  await page.getByRole('button', { name: 'Edit BWP plywood, 18 mm', exact: true }).click();
  await page.getByLabel('Unit cost (₹, before GST)').fill('155');
  await page.getByRole('button', { name: 'Save item', exact: true }).click();
  expect((await saved()).projects[0].items[0].rateId).toBeUndefined();
  expect((await saved()).projects[0].items[0].vendorId).toBe('v2');
  expect((await saved()).rates).toHaveLength(2);
});

test('phone preview changes filling and formatting without changing the BOQ', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const before = await page.evaluate(() => localStorage.getItem('nivo.workspace.v1'));
  await page.getByRole('button', { name: 'Export BOQ', exact: true }).click();
  await page.getByLabel('Fill prices').selectOption('rates');
  await page.getByLabel('Workbook formatting').selectOption('plain');
  await expect(page.getByLabel('Excel calculations')).toBeDisabled();
  const preview = page.getByRole('region', { name: 'Excel preview', exact: true });
  await expect(preview).toContainText('Rates only; no amounts or totals');
  expect(await page.getByRole('dialog').evaluate((d) => d.scrollWidth <= d.clientWidth)).toBe(true);
  await preview.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/export-phone.png', fullPage: true });
  expect(await page.evaluate(() => localStorage.getItem('nivo.workspace.v1'))).toBe(before);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Excel', exact: true }).click();
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile((await (await download).path())!);
  expect(book.getWorksheet('BOQ')!.rowCount).toBe(5);
});

test('new quotation requires vendor evidence and keeps separate brand offers', async ({ page }) => {
  await page.locator('.boq-table').getByRole('button', { name: 'Find rate' }).click();
  await page.getByRole('button', { name: 'Record another offer', exact: true }).click();
  await page.getByLabel('Quoted brand / make').fill('Brand C');
  await page.getByLabel('Quoted model / product code').fill('C1');
  await page.getByLabel('Unit cost (₹)', { exact: true }).fill('90');
  await page.getByLabel('Source reference').fill('Synthetic quote C');
  await page.getByLabel('Delivery location').fill('Delhi');
  await page.getByLabel('Commercial terms').fill('Supply only, GST excluded');
  await page.getByRole('button', { name: 'Save quotation', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Select a vendor');
  await page.getByRole('combobox', { name: 'Vendor', exact: true }).selectOption('v1');
  await page.getByRole('button', { name: 'Save quotation', exact: true }).click();
  await expect(page.locator('.candidate')).toHaveCount(3);
  const w = await page.evaluate(() => JSON.parse(localStorage.getItem('nivo.workspace.v1')!));
  expect(w.rates[0]).toMatchObject({ brand: 'Brand C', model: 'C1', vendorId: 'v1', cost: 90 });
  expect(w.projects[0].items[0].cost).toBeNull();
});
