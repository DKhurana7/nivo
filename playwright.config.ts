import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5178',
    channel: 'chrome',
    headless: true,
    trace: 'retain-on-failure',
    viewport: { width: 1440, height: 1100 },
  },
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:5178', reuseExistingServer: true },
});
