import { test, expect } from "@playwright/test";

const APP = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const TEST_EMAIL = process.env.TEST_EMAIL!;
const TEST_PASSWORD = process.env.TEST_PASSWORD!;
const CHECK = "\u2705";

test.describe("Auth smoke", () => {
  test("login -> persistencia -> debug page OK", async ({ page, context }) => {
    await page.goto(`${APP}/auth/sign-in`);
    await page.getByTestId("email").fill(TEST_EMAIL);
    await page.getByTestId("password").fill(TEST_PASSWORD);
    await page.getByTestId("sign-in-btn").click();

    await page.waitForURL(/\/(?:$|dashboard|home)/, { timeout: 15_000 });

    const cookies = await context.cookies();
    expect(cookies.some((c) => /supabase/.test(c.name))).toBeTruthy();

    await page.goto(`${APP}/debug/auth`);
    const server = page.getByTestId("server-user");
    const client = page.getByTestId("client-user");
    await expect(server).toContainText(CHECK);
    await expect(client).toContainText(CHECK);

    await page.reload();
    await expect(server).toContainText(CHECK);
    await expect(client).toContainText(CHECK);
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
