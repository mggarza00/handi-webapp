import { test, expect } from "@playwright/test";

test.describe("/admin MVP navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/api/test-auth/admin", { waitUntil: "domcontentloaded" });
  });

  test("dashboard loads with KPIs", async ({ page }) => {
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("admin-kpi-requests-today")).toBeVisible();
    await expect(page.getByTestId("admin-kpi-payouts")).toBeVisible();
    await expect(page.getByTestId("admin-kpi-payments-today")).toBeVisible();
  });

  test("navigates to sections", async ({ page }) => {
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await page.getByTestId("admin-nav-requests-desktop").click();
    await expect(page.getByPlaceholder("Ciudad")).toBeVisible();

    await page.getByTestId("admin-nav-professionals-desktop").click();
    await expect(page.getByRole("button", { name: /pendientes/i })).toBeVisible();

    await page.getByTestId("admin-nav-payments-desktop").click();
    await expect(page.getByRole("button", { name: /filtrar/i })).toBeVisible();

    await page.getByTestId("admin-nav-settings-desktop").click();
    await expect(page.getByRole("button", { name: /guardar/i })).toBeVisible();

    await page.getByTestId("admin-nav-system-desktop").click();
    await expect(page.getByRole("button", { name: /Webhooks/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Audit log/i })).toBeVisible();
  });
});
