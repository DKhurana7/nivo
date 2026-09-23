import { test, expect, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { seedWorkspace } from '../../src/lib/seed';
import { quotationPdf } from './quotation-fixture';
const w = seedWorkspace();
w.projects = [
  {
    ...w.projects[0],
    items: [
      {
        ...w.projects[0].items[0],
        id: 'cable',
        description: 'Supply and install copper cable 2.5 sq mm',
        specification: 'Copper FRLS',
        unit: 'm',
        brand: 'Brand A',
        model: '',
        cost: null,
        rateId: undefined,
      },
    ],
  },
];
w.rates = [];
const stored = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('nivo.workspace.v1')!));

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', (r) => r.abort());
  await page.addInitScript((w) => {
    if (!localStorage.getItem('nivo.workspace.v1'))
      localStorage.setItem('nivo.workspace.v1', JSON.stringify(w));
  }, w);
  await page.goto('/#boq');
  await page.getByRole('button', { name: 'Import vendor quotation', exact: true }).click();
});

async function review(page: Page, fixedVendor = false) {
  if (!fixedVendor)
    await page.getByRole('combobox', { name: 'Quotation vendor', exact: true }).selectOption('v1');
  await page.getByRole('button', { name: 'Extract quotation rows', exact: true }).click();
  await page.locator('.document-offer').first().click();
  await expect(page.getByRole('button', { name: 'Save reviewed quotation' })).toBeDisabled();
  await page.getByLabel('Matched BOQ item').selectOption('cable');
  await expect(
    page
      .locator('.document-review .notice')
      .getByText('Unit mismatch: quoted coil, BOQ m.', { exact: true }),
  ).toBeVisible();
  await page.getByLabel('Quoted tax basis').selectOption('including-gst');
  await page.getByLabel('GST included (%)').fill('18');
  await page.getByLabel('Additional discount (%)').fill('10');
  await page.getByLabel('BOQ units per quoted unit').fill('90');
  await expect(page.locator('.document-cost')).toContainText('₹10.00 / m');
  await page.getByLabel('Document quotation date').fill('2026-09-23');
  await page.getByLabel('Document valid until').fill('2099-12-31');
  await page
    .getByLabel('Verified commercial terms')
    .fill('Synthetic quotation: supply only, installation excluded, 90 m coil, freight included.');
  await page.getByRole('checkbox', { name: /I checked the original/ }).check();
  // A changed commercial input must invalidate the previous acknowledgement.
  await page.getByLabel('Verified quoted model').fill('C25 verified');
  await expect(page.getByRole('button', { name: 'Save reviewed quotation' })).toBeDisabled();
  await page.getByRole('checkbox', { name: /I checked the original/ }).check();
  await page.getByRole('button', { name: 'Save reviewed quotation' }).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `test-results/vendor-review-${page.viewportSize()!.width}.png`,
    fullPage: false,
  });
  await page.getByRole('button', { name: 'Save reviewed quotation' }).click();
  await expect(
    page.getByText('Quotation saved with its source file.', { exact: false }),
  ).toBeVisible();
}

test('Excel quotation review, explicit BOQ application, source download and full backup restore', async ({
  page,
}) => {
  const book = new ExcelJS.Workbook(),
    sheet = book.addWorksheet('Vendor prices');
  sheet.addRow(['Description', 'Unit', 'Quantity', 'Rate', 'Amount', 'Brand', 'Model']);
  sheet.addRow(['Copper cable 2.5 sq mm', 'coil', 10, 1180, 11800, 'Brand A', 'C25']);
  sheet.addRow(['Copper cable 4 sq mm', 'coil', 10, 1500, 15000, 'Brand B', 'C4']);
  const bytes = Buffer.from(await book.xlsx.writeBuffer());
  await page
    .getByLabel('Vendor PDF or Excel file')
    .setInputFiles({ name: 'vendor.xlsx', mimeType: 'application/octet-stream', buffer: bytes });
  await expect(page.getByLabel('Unit rate column')).toHaveValue('4');
  await page.screenshot({ path: 'test-results/vendor-import-desktop.png', fullPage: true });
  await review(page);
  let saved = await stored(page);
  expect(saved.rates).toHaveLength(1);
  expect(saved.rates[0]).toMatchObject({
    cost: 10,
    unit: 'm',
    vendorId: 'v1',
    brand: 'Brand A',
    model: 'C25 verified',
    document: { quotedRate: 1180, quotedUnit: 'coil', location: 'Vendor prices, row 2' },
  });
  expect(saved.projects[0].items[0].cost).toBeNull();
  await page.locator('.document-offer').first().click();
  await page.getByLabel('Matched BOQ item').selectOption('cable');
  await expect(page.getByText(/This source row is already saved/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save reviewed quotation' })).toBeDisabled();
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.locator('.boq-table').getByRole('button', { name: 'Find rate' }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Apply rate', exact: true }).click();
  saved = await stored(page);
  expect(saved.projects[0].items[0]).toMatchObject({
    cost: 10,
    vendorId: 'v1',
    brand: 'Brand A',
    rateId: saved.rates[0].id,
  });
  await page.goto('/#rates');
  await page
    .getByRole('button', { name: 'View Copper cable 2.5 sq mm', exact: true })
    .first()
    .click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download original quotation' }).click();
  expect(readFileSync((await (await download).path())!)).toEqual(bytes);
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.goto('/#settings');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export full backup', exact: true }).click();
  const file = await downloading,
    backup = JSON.parse(readFileSync((await file.path())!, 'utf8'));
  const fileId = backup.workspace.rates[0].document.fileId;
  expect(Buffer.from(backup.workbooks[fileId], 'base64')).toEqual(bytes);
  await page.getByRole('button', { name: 'Start an empty workspace', exact: true }).click();
  await page.getByRole('button', { name: 'Start empty', exact: true }).click();
  await page.getByLabel('Restore a backup', { exact: true }).setInputFiles((await file.path())!);
  await page.getByRole('button', { name: 'Restore workspace', exact: true }).click();
  await expect.poll(async () => (await stored(page)).rates).toEqual(backup.workspace.rates);
  await page.reload();
  await page.goto('/#rates');
  await page
    .getByRole('button', { name: 'View Copper cable 2.5 sq mm', exact: true })
    .first()
    .click();
  const restored = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download original quotation' }).click();
  expect(readFileSync((await (await restored).path())!)).toEqual(bytes);
});

test('selectable PDF extracts rates and preserves evidence on a phone; scanned-only PDF is refused', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('Vendor PDF or Excel file').setInputFiles({
    name: 'scanned.pdf',
    mimeType: 'application/pdf',
    buffer: quotationPdf(true),
  });
  await expect(page.getByRole('alert')).toContainText('no selectable text');
  const bytes = quotationPdf();
  await page
    .getByLabel('Vendor PDF or Excel file')
    .setInputFiles({ name: 'vendor.pdf', mimeType: 'application/pdf', buffer: bytes });
  await expect(page.getByLabel('Unit rate column')).toHaveValue('3');
  await expect(page.getByRole('region', { name: 'Quotation source rows' })).toContainText('11800');
  expect(await page.getByRole('dialog').evaluate((d) => d.scrollWidth <= d.clientWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/vendor-import-phone.png', fullPage: true });
  await review(page);
  expect((await stored(page)).rates[0].document).toMatchObject({
    filename: 'vendor.pdf',
    location: 'Page 1, line 2',
    sha256: createHash('sha256').update(bytes).digest('hex'),
    quotedRate: 1180,
  });
});

test('enquiry import is restricted to its vendor and requested items, with partial replies still awaiting quotes', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.evaluate(() => {
    const w = JSON.parse(localStorage.getItem('nivo.workspace.v1')!);
    w.projects[0].items.push(
      { ...w.projects[0].items[0], id: 'second', description: 'Second requested item' },
      { ...w.projects[0].items[0], id: 'outside', description: 'Outside this enquiry' },
    );
    w.enquiries = [
      {
        id: 'e-doc',
        projectId: w.projects[0].id,
        vendorId: 'v1',
        itemIds: ['cable', 'second'],
        status: 'Prepared',
        createdAt: '2026-09-23',
        notes: '',
        transcript: '',
      },
    ];
    localStorage.setItem('nivo.workspace.v1', JSON.stringify(w));
  });
  await page.goto('/#enquiries');
  await page.reload();
  await page.locator('.enquiry-row').click();
  await page.getByRole('button', { name: 'Import vendor quotation', exact: true }).click();
  await expect(
    page.getByRole('combobox', { name: 'Quotation vendor', exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel('Vendor PDF or Excel file')
    .setInputFiles({ name: 'enquiry.pdf', mimeType: 'application/pdf', buffer: quotationPdf() });
  await review(page, true);
  const saved = await stored(page);
  expect(saved.enquiries[0]).toMatchObject({
    status: 'Awaiting quote',
    quotes: [{ itemId: 'cable', rateId: saved.rates[0].id }],
  });
  await page.locator('.document-offer').first().click();
  expect(
    await page.getByLabel('Matched BOQ item').locator('option').allTextContents(),
  ).not.toContain('01: Outside this enquiry / m');
  await expect(page.getByLabel('Matched BOQ item').locator('option')).toHaveCount(3);
});
