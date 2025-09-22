import { defineConfig, devices, type ReporterDescription } from "@playwright/test";
import base from "./playwright.config";

const baseURL =
  (base.use?.baseURL as string | undefined) ||
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3100";
const parsed = new URL(baseURL);
const port = parsed.port ? parseInt(parsed.port, 10) : parsed.protocol === "https:" ? 443 : 80;

const reporters: ReporterDescription[] = [
  ["github"],
  ["list"],
  ["junit", { outputFile: "artifacts/latest/junit.xml" }],
  ["json", { outputFile: "artifacts/latest/results.json" }],
  ["html", { outputFolder: "artifacts/latest/html", open: "never" }],
];

export default defineConfig({
  ...base,
  forbidOnly: true,
  retries: 2,
  reporter: reporters,
  use: {
    ...base.use,
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects:
    base.projects && base.projects.length > 0
      ? base.projects
      : [
          {
            name: "chromium",
            use: {
              ...devices["Desktop Chrome"],
            },
          },
        ],
  workers: 1,
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : base.webServer
    ? {
        ...base.webServer,
        command: `cross-env PORT=${port} NEXT_PUBLIC_APP_URL=${baseURL} next start -p ${port}`,
        url: baseURL,
        reuseExistingServer: false,
      }
    : undefined,
});
