import { defineConfig } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { existsSync } from "fs";
import path from "path";

// Load environment variables for local/e2e runs
// Priority: .env -> .env.local (local overrides base)
try {
  const root = process.cwd();
  const baseEnv = path.resolve(root, ".env");
  const localEnv = path.resolve(root, ".env.local");
  if (existsSync(baseEnv)) {
    loadEnv({ path: baseEnv });
  }
  if (existsSync(localEnv)) {
    loadEnv({ path: localEnv, override: true });
  }
} catch {}

// Use a dedicated E2E port to avoid conflicts with local dev servers
const E2E_PORT = parseInt(process.env.E2E_PORT || "3100", 10);
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${E2E_PORT}`;
// Ensure Next.js and the app use the same base URL during tests
process.env.NEXT_PUBLIC_APP_URL = baseURL;

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  use: {
    baseURL,
    headless: true,
    trace: "on-first-retry",
  },
  reporter: [["list"], ["html", { open: "never" }]],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        // Pin the port for stability and pass base URL
        command: `cross-env PORT=${E2E_PORT} NEXT_PUBLIC_APP_URL=${baseURL} next dev -p ${E2E_PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
