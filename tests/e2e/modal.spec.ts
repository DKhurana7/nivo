import { test, expect } from '@playwright/test';

test('modal keyboard focus wraps inside project and pricing dialogs', async ({ page }) => {
  await page.route('**/api/**', (route) => route.abort());
  await page.goto('/#boq');
  for (const triggerName of ['Project details', 'Pricing settings']) {
    const trigger = page.getByRole('button', { name: triggerName, exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog');
    const first = dialog.getByRole('button', { name: 'Close dialog' });
    const last = dialog.getByRole('button', {
      name: triggerName === 'Project details' ? 'Save project details' : 'Save pricing',
    });
    await last.focus();
    await page.keyboard.press('Tab');
    await expect(first).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(last).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  }
});
