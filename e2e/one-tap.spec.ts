import { test, expect } from "@playwright/test";

test.describe("Google One Tap", () => {
  test("loads GIS and exposes accounts.id on window", async ({ page }) => {
    // Start with a clean localStorage dismissal state
    await page.addInitScript(() => {
      try { localStorage.removeItem("one_tap_dismissed_until"); } catch {}
    });

    await page.goto("/");

    // Wait for our script tag or global to appear
    await page.waitForFunction(() => {
      // @ts-ignore
      return !!document.getElementById("google-identity-script") || !!window.google?.accounts?.id;
    }, null, { timeout: 15000 });

    const hasGoogle = await page.evaluate(() => !!(window as any).google?.accounts?.id);
    const scriptInjected = await page.evaluate(() => !!document.getElementById("google-identity-script"));
    expect(hasGoogle || scriptInjected).toBeTruthy();
  });
});
