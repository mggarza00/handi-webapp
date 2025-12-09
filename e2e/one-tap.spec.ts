import { test, expect } from "@playwright/test";

const isCi = process.env.CI === "true";

// Si estamos en CI, saltamos TODOS los tests de este archivo.
test.skip(isCi, "Skipping this e2e suite in CI until the flow is stabilized");

test.describe("Google One Tap", () => {
  test("loads GIS and exposes accounts.id on window", async ({ page }) => {
    // Start with a clean localStorage dismissal state
    await page.addInitScript(() => {
      try {
        localStorage.removeItem("one_tap_dismissed_until");
      } catch {
        /* no-op */
      }
    });

    await page.goto("/");

    type GoogleWindow = Window &
      Partial<{
        google: {
          accounts?: { id?: unknown };
        };
      }>;

    // Wait for our script tag or global to appear
    await page.waitForFunction(
      () => {
        const w = window as GoogleWindow;
        return (
          !!document.getElementById("google-identity-script") ||
          !!w.google?.accounts?.id
        );
      },
      null,
      { timeout: 15000 },
    );

    const hasGoogle = await page.evaluate(() => {
      const w = window as GoogleWindow;
      return !!w.google?.accounts?.id;
    });
    const scriptInjected = await page.evaluate(
      () => !!document.getElementById("google-identity-script"),
    );
    expect(hasGoogle || scriptInjected).toBeTruthy();
  });
});
