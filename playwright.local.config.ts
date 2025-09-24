import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testDir: 'tests/e2e',
  use: {
    ...base.use,
    baseURL: process.env.E2E_BASE_URL || (base.use?.baseURL as string | undefined) || 'http://localhost:3000',
  },
  // Requiere un server ya corriendo (npm run dev). No iniciar otro.
  webServer: undefined,
  projects: base.projects && base.projects.length > 0
    ? base.projects
    : [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});

