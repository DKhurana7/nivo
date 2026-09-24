/** Explicit live browser check against the ephemeral synthetic studio; never dials a telephone. */
import { chromium, expect } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
const login = JSON.parse(await readFile('data/voice-test-login.json', 'utf8'));
const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const context = await browser.newContext({
  permissions: ['microphone'],
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
// Keep the dedicated voice smoke independent of first-login onboarding.
await page.route('**/api/onboarding', (route) => route.fulfill({ json: { showTour: false } }));
await mkdir('data/verification', { recursive: true });
try {
  await page.goto('http://127.0.0.1:5178/');
  await page.getByLabel('Email', { exact: true }).fill(login.email);
  await page.getByLabel('Password', { exact: true }).fill(login.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Studio server connected')).toBeVisible();
  await page.goto('http://127.0.0.1:5178/#enquiries');
  await page.locator('.enquiry-row').first().click();
  await expect(page.getByRole('button', { name: 'Test in browser' })).toBeEnabled({
    timeout: 10000,
  });
  await page.getByRole('button', { name: 'Test in browser' }).click();
  await expect(page.getByText('Microphone connected', { exact: true })).toBeVisible({
    timeout: 30000,
  });
  await page.getByRole('button', { name: 'Mute microphone', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Unmute microphone', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Unmute microphone', exact: true }).click();
  await expect(page.getByRole('log', { name: 'Call transcript' })).toContainText(
    'automated quotation assistant',
    { timeout: 90000 },
  );
  await page.screenshot({ path: 'data/verification/live-voice-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.voice-desk').scrollIntoViewIfNeeded();
  expect(
    await page.locator('.modal').evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth),
  ).toBe(true);
  await page.screenshot({ path: 'data/verification/live-voice-phone.png', fullPage: true });
  await page.getByRole('button', { name: 'End call', exact: true }).click();
  await expect(page.getByRole('button', { name: 'End call', exact: true })).toHaveCount(0, {
    timeout: 15000,
  });
  await expect(page.getByRole('button', { name: 'Test in browser' })).toBeEnabled();
  console.log(
    'Live browser microphone, received transcript, mute/unmute and end-call checks passed.',
  );
} finally {
  // End any synthetic session even when a UI assertion fails.
  await page
    .evaluate(async () => {
      const response = await fetch('/api/calls');
      if (!response.ok) return;
      for (const call of await response.json())
        if (['starting', 'active', 'connected'].includes(call.status))
          await fetch(`/api/calls/${call.id}/end`, {
            method: 'POST',
            headers: { 'X-Nivo-Request': '1' },
          });
    })
    .catch(() => {});
  await context.close();
  await browser.close();
}
