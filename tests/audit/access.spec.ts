import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('explicit local demo, authenticated sign-in, invalid credentials and busy state', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore the local demo', exact: true }).click();
  await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
  await page.evaluate(() => {
    location.hash = 'enquiries';
  });
  await page.getByRole('button', { name: 'Prepare enquiry', exact: true }).click();
  await page.getByRole('button', { name: 'Prepare brief', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText(
    'Sign in to a studio server to test the voice agent',
  );
  await expect(page.getByRole('button', { name: 'Test in browser' })).toHaveCount(0);
  await page.reload();
  await page.getByLabel('Email', { exact: true }).fill('nonexistent@audit.local');
  await page.getByLabel('Password', { exact: true }).fill('invalid-synthetic-password');
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/api/login', async (route) => {
    await gate;
    await route.continue();
  });
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Opening studio…', exact: true })).toBeDisabled();
  release();
  await expect(page.getByRole('alert')).toContainText('Email or password is incorrect');
  await page.unroute('**/api/login');
  const account = JSON.parse(readFileSync('data/audit-login.json', 'utf8')).accounts.find(
    (a: any) => a.email === 'alpha@audit.local',
  );
  await page.getByLabel('Email', { exact: true }).fill(account.email);
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Studio server connected', { exact: true })).toBeVisible();
});
