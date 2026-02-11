import { defineConfig, devices } from "@playwright/test";

const bypassEnv = process.env.E2E_ADMIN_BYPASS || "1";
const defaultPort = bypassEnv === "1" ? 3001 : 3000;
const PORT = Number(process.env.PORT || defaultPort);
const useDevServer = bypassEnv === "1";

export default defineConfig({
  testDir: "e2e", // <-- solo corre tests en e2e/
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30_000,
  use: {
    baseURL: process.env.E2E_BASE_URL || `http://localhost:${PORT}`,
    headless: true,
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: useDevServer ? "pnpm dev" : "pnpm start", // dev server needed for test-auth endpoints
    url: `http://localhost:${PORT}`,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      PORT: String(PORT),
      E2E_ADMIN_BYPASS: bypassEnv,
      NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`,
      NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
      ...(process.env.E2E_SEED ? { E2E_SEED: process.env.E2E_SEED } : {}),
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
