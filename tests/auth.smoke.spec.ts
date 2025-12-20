import { test, expect } from "@playwright/test";

const TEST_EMAIL = process.env.TEST_EMAIL!;
const TEST_PASSWORD = process.env.TEST_PASSWORD!;
const CHECK = "\u2705";

test.describe("Auth smoke", () => {
  test("login -> persistencia -> debug page OK", async ({ page, context, request, baseURL }) => {
    // Best-effort: ensure test login user exists (creates if missing)
    if (baseURL) {
      await request.get(`${baseURL}/api/test-seed?action=seed`).catch(() => undefined);
    }
    await page.goto(`/auth/sign-in`);
    await page.getByTestId("email").fill(TEST_EMAIL);
    await page.getByTestId("password").fill(TEST_PASSWORD);
    await page.getByTestId("sign-in-btn").click();

    await page.waitForURL(/\/(?:$|dashboard|home)/, { timeout: 15_000 });

    await page.goto(`/debug/auth`);
    const server = page.getByTestId("server-user");
    const client = page.getByTestId("client-status");
    await expect(server).toContainText(/Server sees user/i);
    await expect(client).toContainText(/Server and client see a session/i);

    await page.reload();
    await expect(server).toContainText(/Server sees user/i);
    await expect(client).toContainText(/Server and client see a session/i);
  });

  test("canonical redirects (solo prod)", async ({ page }) => {
    test.skip(process.env.NODE_ENV !== "production", "Solo en prod");
    const res = await page.goto("http://www.handi.mx/", {
      waitUntil: "domcontentloaded",
    });
    expect(res?.status()).toBeGreaterThanOrEqual(300);
    expect(res?.status()).toBeLessThan(400);
  });
});
