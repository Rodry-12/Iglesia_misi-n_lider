import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  reporter: 'list',
  use: {
    baseURL: 'https://localhost:4200',
    ignoreHTTPSErrors: true,
    channel: 'chrome',
    headless: true,
    reducedMotion: 'reduce',
    screenshot: process.env['MLP_SKIP_VISUAL_ARTIFACTS'] === '1' ? 'off' : 'only-on-failure',
    trace: process.env['MLP_SKIP_VISUAL_ARTIFACTS'] === '1' ? 'off' : 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: 'npm start',
    url: 'https://localhost:4200',
    ignoreHTTPSErrors: true,
    reuseExistingServer: true,
    timeout: 120000,
  },
});
