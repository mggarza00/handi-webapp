import { defineConfig } from "@playwright/test";

const baseURL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

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
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
