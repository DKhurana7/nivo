import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test.skip(
  process.env.NIVO_WORKER_DOWN !== '1',
  'Run only while the local audit worker is deliberately paused',
);
test('worker unavailable is reported and call creation refuses promptly', async ({ page }) => {
  const login = JSON.parse(readFileSync('data/audit-voice-login.json', 'utf8'));
  const headers = { 'X-Nivo-Request': '1' };
  expect(login.email).toBe('alpha@audit.local');
  expect((await page.request.post('/api/login', { headers, data: login })).status()).toBe(200);
  const before = await (await page.request.get('/api/calls')).json();
  await page.goto('/#enquiries');
  await page.locator('.enquiry-row').first().click();
  await expect(page.locator('.voice-desk')).toContainText('Voice worker is not connected');
  await expect(page.getByRole('button', { name: 'Test in browser' })).toBeDisabled();
  const started = Date.now();
  const response = await page.request.post('/api/calls', {
    headers,
    data: { enquiryId: 'audit-voice-enquiry', mode: 'browser', requestId: crypto.randomUUID() },
  });
  expect(response.status()).toBe(503);
  expect(Date.now() - started).toBeLessThan(5000);
  const after = await (await page.request.get('/api/calls')).json();
  expect(after.length).toBe(before.length);
});
