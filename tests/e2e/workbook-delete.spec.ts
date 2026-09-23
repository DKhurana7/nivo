import { test, expect } from '@playwright/test';
import { seedWorkspace } from '../../src/lib/seed';

test('removing a mapped item warns that original export is disabled for the project', async ({
  page,
}) => {
  await page.route('**/api/**', (route) => route.abort());
  const workspace = seedWorkspace();
  workspace.projects[0].items.forEach((item, index) => {
    item.sourceRow = index + 2;
  });
  workspace.projects[0].workbookId = 'synthetic-source';
  workspace.projects[0].mapping = {
    sheet: 'Client',
    headerRow: 1,
    description: 1,
    unit: 2,
    quantity: 3,
    rate: 4,
  };
  await page.addInitScript(
    (w) => localStorage.setItem('nivo.workspace.v1', JSON.stringify(w)),
    workspace,
  );
  await page.goto('/#boq');
  await page.getByRole('button', { name: 'Delete LED downlight, 12 W', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('original workbook');
  await expect(page.getByRole('dialog')).toContainText('entire project');
  await page.screenshot({ path: 'test-results/delete-warning-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/delete-warning-phone.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.getByRole('button', { name: 'Keep item', exact: true }).click();
  await page.getByRole('button', { name: 'Export BOQ', exact: true }).click();
  await expect(page.getByRole('button', { name: /Fill the original workbook/ })).toBeEnabled();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Delete LED downlight, 12 W', exact: true }).click();
  await page.getByRole('button', { name: 'Remove item', exact: true }).click();
  await expect(page.locator('.boq-table tbody tr')).toHaveCount(7);
  await page.getByRole('button', { name: 'Export BOQ', exact: true }).click();
  await expect(page.getByRole('button', { name: /Fill the original workbook/ })).toBeDisabled();
});
