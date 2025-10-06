import { test, expect } from "@playwright/test";

test.describe("Políticas de facturación", () => {
  test("renderiza y contiene secciones clave", async ({ page }) => {
    const res = await page.request.get(`/politicas-facturacion`);
    expect(res.ok()).toBeTruthy();

    await page.goto(`/politicas-facturacion`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /Políticas de facturación/i })).toBeVisible();

    // Secciones principales
    for (const id of [
      "modelo",
      "comisiones",
      "factura-homaid",
      "factura-servicio",
      "actualizacion",
      "plazos",
      "reembolsos",
      "requisitos-pro",
      "faq",
      "contacto",
    ]) {
      await expect(page.locator(`#${id}`)).toBeVisible();
    }

    // Links internos
    const terms = page.locator('a[href="/terminos"]');
    const privacy = page.locator('a[href="/privacy"]');
    await expect(terms.first()).toBeVisible();
    await expect(privacy.first()).toBeVisible();
  });
});

