import { test, expect } from "@playwright/test";

test.describe("/admin MVP navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/api/test-auth/admin", { waitUntil: "domcontentloaded" });
  });

  test("dashboard loads with KPIs", async ({ page }) => {
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/Solicitudes \(hoy\)/i)).toBeVisible();
    await expect(page.getByText(/KYC pendientes/i)).toBeVisible();
    await expect(page.getByText(/Pagos \(MXN\)/i)).toBeVisible();
  });

  test("navigates to sections", async ({ page }) => {
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name: /Solicitudes/i }).click();
    await expect(page.getByRole("combobox")).toBeVisible();

    await page.getByRole("link", { name: /Profesionales/i }).click();
    await expect(page.getByText(/onboarding/i).or(page.getByText(/KYC/i))).toBeVisible();

    await page.getByRole("link", { name: /Pagos/i }).click();
    await expect(page.getByRole("table")).toBeVisible();

    await page.getByRole("link", { name: /Configuración/i }).click();
    await expect(page.getByLabel(/Comisión/)).toBeVisible();
    await expect(page.getByLabel(/IVA/)).toBeVisible();

    await page.getByRole("link", { name: /Sistema/i }).click();
    await expect(page.getByRole("button", { name: /Webhooks/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Audit log/i })).toBeVisible();
  });
});

