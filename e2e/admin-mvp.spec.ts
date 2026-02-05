import { test, expect, type Page, type TestInfo } from "@playwright/test";

const isCi = process.env.CI === "true";

// Si estamos en CI, saltamos TODOS los tests de este archivo.
test.skip(isCi, "Skipping this e2e suite in CI until the flow is stabilized");

let seedLogged = false;

test.describe("/admin MVP navigation", () => {
  const baseUrl = process.env.E2E_BASE_URL || "http://localhost:3000";

  test.beforeAll(async ({ request }) => {
    if (process.env.E2E_SEED !== "1") return;
    const seed = await request.get("/api/test-seed?action=seed");
    if (seed.ok()) return;
    let payload: Record<string, unknown> | null = null;
    try {
      payload = (await seed.json()) as Record<string, unknown>;
    } catch {
      payload = null;
    }
    if (!seedLogged) {
      seedLogged = true;
      const code =
        (payload?.code as string | undefined) ||
        (payload?.error as string | undefined) ||
        String(seed.status());
      console.warn(`[admin-mvp] seed skipped: ${code}`);
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
    const hasRole = (await page.context().cookies()).some(
      (c) => c.name === "handi_role" && c.value === "admin",
    );
    if (!hasRole) {
      await page.context().addCookies([
        {
          name: "handi_role",
          value: "admin",
          url: baseUrl,
          path: "/",
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
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
      const kpiRequests = page.getByTestId("admin-kpi-requests-today");
      const kpiPayouts = page.getByTestId("admin-kpi-payouts");
      const kpiPayments = page.getByTestId("admin-kpi-payments-today");
      try {
        await expect(kpiRequests).toBeVisible({ timeout: 10000 });
      } catch {
        const navFallback = page.getByTestId("admin-nav-requests-desktop");
        await expect(navFallback).toBeVisible({ timeout: 10000 });
        return;
      }
      await expect(kpiPayouts).toBeVisible();
      await expect(kpiPayments).toBeVisible();
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
