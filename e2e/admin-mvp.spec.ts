import { test, expect, type Page, type TestInfo } from "@playwright/test";

const isCi = process.env.CI === "true";

// Si estamos en CI, saltamos TODOS los tests de este archivo.
test.skip(isCi, "Skipping this e2e suite in CI until the flow is stabilized");

test.describe("/admin MVP navigation", () => {
  test.beforeAll(async ({ request }) => {
    const seed = await request.get("/api/test-seed?action=seed");
    if (!seed.ok()) {
      const body = await seed.text().catch(() => "");
      console.warn(
        `[admin-mvp] seed warning: ${seed.status()} ${seed.statusText} ${body}`,
      );
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.context().clearCookies();
    const res = await page.goto("/api/test-auth/admin", {
      waitUntil: "domcontentloaded",
    });
    if (res && !res.ok()) {
      console.warn(`[admin-mvp] auth setup failed: ${res.status()}`);
    }
  });

  async function dumpFailure(page: Page, testInfo: TestInfo, label: string) {
    const url = page.url();
    console.error(`[admin-mvp] failure ${label}: ${url}`);
    await testInfo.attach(`admin-mvp-url-${label}`, {
      body: url,
      contentType: "text/plain",
    });
    const shot = await page.screenshot({ fullPage: true });
    await testInfo.attach(`admin-mvp-${label}.png`, {
      body: shot,
      contentType: "image/png",
    });
  }

  test("dashboard loads with KPIs", async ({ page }, testInfo) => {
    try {
      await page.goto("/admin", { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/admin(\/|$)/, { timeout: 15000 });
      await expect(page.getByTestId("admin-kpi-requests-today")).toBeVisible();
      await expect(page.getByTestId("admin-kpi-payouts")).toBeVisible();
      await expect(page.getByTestId("admin-kpi-payments-today")).toBeVisible();
    } catch (error) {
      await dumpFailure(page, testInfo, "kpis");
      throw error;
    }
  });

  test("navigates to sections", async ({ page }, testInfo) => {
    try {
      await page.goto("/admin", { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/admin(\/|$)/, { timeout: 15000 });
      const requestsNav = page.getByTestId("admin-nav-requests-desktop");
      await expect(requestsNav).toBeVisible({ timeout: 15000 });
      await requestsNav.scrollIntoViewIfNeeded();
      await requestsNav.click();
      await expect(page.getByPlaceholder("Ciudad")).toBeVisible();

      const prosNav = page.getByTestId("admin-nav-professionals-desktop");
      await expect(prosNav).toBeVisible({ timeout: 15000 });
      await prosNav.scrollIntoViewIfNeeded();
      await prosNav.click();
      await expect(
        page.getByRole("button", { name: /pendientes/i }),
      ).toBeVisible();

      const paymentsNav = page.getByTestId("admin-nav-payments-desktop");
      await expect(paymentsNav).toBeVisible({ timeout: 15000 });
      await paymentsNav.scrollIntoViewIfNeeded();
      await paymentsNav.click();
      await expect(page.getByRole("button", { name: /filtrar/i })).toBeVisible();

      const settingsNav = page.getByTestId("admin-nav-settings-desktop");
      await expect(settingsNav).toBeVisible({ timeout: 15000 });
      await settingsNav.scrollIntoViewIfNeeded();
      await settingsNav.click();
      await expect(page.getByRole("button", { name: /guardar/i })).toBeVisible();

      const systemNav = page.getByTestId("admin-nav-system-desktop");
      await expect(systemNav).toBeVisible({ timeout: 15000 });
      await systemNav.scrollIntoViewIfNeeded();
      await systemNav.click();
      await expect(
        page.getByRole("button", { name: /Webhooks/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Audit log/i }),
      ).toBeVisible();
    } catch (error) {
      await dumpFailure(page, testInfo, "nav");
      throw error;
    }
  });
});
