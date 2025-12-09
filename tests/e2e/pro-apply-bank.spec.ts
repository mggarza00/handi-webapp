import { test, expect } from "@playwright/test";

test.describe("Pro Apply — Cuentas bancarias", () => {
  test("valida CLABE y muestra mensajes", async ({ page }) => {
    await page.route("**/api/catalog/categories", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ ok: true, data: [{ category: "Plomería", subcategory: "Instalación" }] }),
      });
    });

    await page.goto("/api/test-auth/login?email=pro.apply@homaid.dev&role=pro&next=/pro-apply", { waitUntil: "domcontentloaded" });
    await page.goto("/pro-apply", { waitUntil: "domcontentloaded" });
    // La sección puede estar fuera de viewport inicial; verificamos campo por etiqueta
    await expect(page.getByLabel("Nombre del titular")).toBeVisible();

    await page.getByLabel("Nombre del titular").fill("Juan Pérez");
    await page.getByLabel("Banco").fill("BBVA");
    await page.getByLabel(/CLABE/).fill("1234 5678 9012 3456 7");
    await expect(page.getByText(/CLABE incompleta \(18 dígitos requeridos\)/i)).toBeVisible();

    // Completar a 18 dígitos con un DV que probablemente no coincida
    await page.getByLabel(/CLABE/).fill("123456789012345678");
    await expect(page.getByText(/CLABE inválida/i)).toBeVisible();
  });
});
