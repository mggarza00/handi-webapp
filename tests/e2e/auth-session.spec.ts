import { test, expect } from "@playwright/test";

const APP_URL = process.env.E2E_APP_URL ?? "http://localhost:3000";
const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? "e2e+cookies@handi.dev";

const ensureAbsolute = (path: string) => `${APP_URL.replace(/\/$/, "")}${path}`;

test.describe("Supabase session flow", () => {
  test("maintains cookie across redirects and navigation", async ({ page, request }) => {
    await page.goto(APP_URL, { waitUntil: "domcontentloaded" });

    const loginResponse = await request.get(
      `${APP_URL}/api/test-auth/login?email=${encodeURIComponent(TEST_EMAIL)}&next=/`,
    );
    expect(loginResponse.ok()).toBeTruthy();
    const payload = await loginResponse.json();
    expect(payload?.action_link).toBeTruthy();

    await page.goto(payload.action_link, { waitUntil: "networkidle" });

    const finalUrl = new URL(page.url());
    expect(finalUrl.origin).toBe(new URL(APP_URL).origin);

    await expect(page.locator('[data-testid="avatar"]')).toBeVisible({ timeout: 10000 });

    await page.goto(ensureAbsolute("/debug/auth"), { waitUntil: "networkidle" });
    await expect(page.getByTestId("server-user")).toContainText("Server sees user", { timeout: 10000 });
    await expect(page.getByTestId("client-status")).toContainText(
      "Server and client see a session",
      { timeout: 10000 },
    );
    await expect(page.getByTestId("client-session")).toContainText("userId", { timeout: 10000 });

    const routes = ["/requests?mine=1", "/favorites", "/notifications"];
    for (const route of routes) {
      await page.goto(ensureAbsolute(route), { waitUntil: "networkidle" });
      await expect(page.locator('[data-testid="avatar"]')).toBeVisible({ timeout: 10000 });
      expect(new URL(page.url()).origin).toBe(new URL(APP_URL).origin);
    }
  });
});
