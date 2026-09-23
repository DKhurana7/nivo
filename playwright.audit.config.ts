import { defineConfig } from '@playwright/test';

// Explicit opt-in: this suite writes only the fictional audit account on the local API.
export default defineConfig({
  testDir: './tests/audit',
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: 'http://127.0.0.1:5178',
    channel: 'chrome',
    headless: true,
    viewport: { width: 1440, height: 1100 },
    trace: 'retain-on-failure',
  },
  outputDir: 'data/audit-browser-results',
});
