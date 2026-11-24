import { defineConfig } from '@playwright/test';
const port = Number(process.env['MLP_PEOPLE_FRONTEND_PORT']);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error('Explicit isolated frontend port required');
export default defineConfig({
  outputDir: process.env['MLP_PEOPLE_RESULTS_DIR'] ?? '../backend/.local/people-browser-results',
  testDir: './e2e',
  testMatch:
    process.env['MLP_BRANCH_BROWSER'] === '1'
      ? 'branches-real.spec.ts'
      : process.env['MLP_USER_BROWSER'] === '1'
        ? 'users-real.spec.ts'
        : 'people-registration-real.spec.ts',
  workers: 1,
  fullyParallel: false,
  timeout: 60000,
  expect: { timeout: 15000 },
  reporter: 'list',
  use: {
    baseURL: `https://localhost:${port}`,
    ignoreHTTPSErrors: true,
    channel: 'chrome',
    headless: true,
    trace: 'off',
    video: 'off',
    screenshot: 'off',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: `npm start -- --port ${port}`,
    url: `https://localhost:${port}`,
    ignoreHTTPSErrors: true,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
