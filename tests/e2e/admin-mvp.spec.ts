import { test, expect } from "@playwright/test";

test.describe("Admin MVP guard", () => {
  test("redirects unauthenticated to /auth/sign-in", async ({ page }) => {
    await page.context().clearCookies();
    const res = await page.goto("/admin", { waitUntil: "domcontentloaded" });
    // In Next, redirect happens; verify final URL contains /auth/sign-in
    expect(page.url()).toMatch(/\/auth\/sign-in/i);
    // And the response should be ok after redirect
    expect(res?.status()).toBeLessThan(400);
  });

  test("allows admin in dev via test-auth role cookie", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/api/test-auth/admin", { waitUntil: "domcontentloaded" });
    await page.goto("/admin", { waitUntil: "domcontentloaded" });

    await expect(page.getByText("KYC pendientes")).toBeVisible();
    await expect(page.getByText("Solicitudes (hoy)")).toBeVisible();
    await expect(page.getByText("Pagos (MXN)")).toBeVisible();

    // Sidebar links exist
    await expect(page.getByRole("link", { name: /Solicitudes/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Profesionales/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Pagos/i })).toBeVisible();
  });
});

