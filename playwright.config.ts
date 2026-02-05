import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT || 3000);
const useDevServer = process.env.E2E_ADMIN_BYPASS === "1";

export default defineConfig({
  testDir: 'e2e',                 // <-- solo corre tests en e2e/
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30_000,
  use: {
    baseURL: process.env.E2E_BASE_URL || `http://localhost:${PORT}`,
    headless: true,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: useDevServer ? "pnpm dev" : "pnpm start", // dev server needed for test-auth endpoints
    url: `http://localhost:${PORT}`,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      PORT: String(PORT),
      ...(process.env.E2E_ADMIN_BYPASS
        ? { E2E_ADMIN_BYPASS: process.env.E2E_ADMIN_BYPASS }
        : {}),
      ...(process.env.E2E_SEED ? { E2E_SEED: process.env.E2E_SEED } : {}),
    },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
