import { test, expect } from "@playwright/test";

// This test focuses on the UI/UX for the professional application form when applying as a company.
// It verifies: login via test-auth, company toggle + animated fields, reference placeholders,
// signature dialog draw + preview, and privacy checkbox toggle.

test.describe("Pro Apply — Company flow (UI)", () => {
  test("shows company fields, signature dialog works, and privacy checkbox toggles", async ({ page }) => {
    // 1) Mock categories endpoint used by the form
    await page.route("**/api/catalog/categories", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({
          ok: true,
          data: [
            { category: "Construcción", subcategory: "Albañilería" },
            { category: "Plomería", subcategory: "Instalación" },
          ],
        }),
      });
    });

    // 2) Establish a test session (dev/CI) using the endpoint that sets a cookie fallback
    await page.goto(
      "/api/test-auth/login?email=pro.apply@handi.dev&role=pro&next=/pro-apply",
      { waitUntil: "domcontentloaded" },
    );

    // 3) Visit the pro-apply form
    await page.goto("/pro-apply", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /Ingresa los datos de tu postulación/i }),
    ).toBeVisible();

    // 4) Toggle "Represento a una empresa" and verify animated fields appear
    await page.getByText("Represento a una empresa").click();
    // Razón social becomes visible after slide-down
    await expect(page.getByLabel("Razón social")).toBeVisible();

    // Fill company fields
    await page.getByLabel("Razón social").fill("Empresa Demo SA de CV");
    await page.getByLabel("Giro o sector").fill("Construcción");
    await page.getByLabel("Número de empleados (opcional)").fill("20");
    await page.getByLabel("Sitio (opcional)").fill("https://empresa.demo");

    // 5) References placeholder should adapt for company
    await expect(page.getByPlaceholder("ej. Proveedor o Cliente").first()).toBeVisible();

    // 6) Open signature dialog, draw, accept, and preview should appear
    await page.getByRole("button", { name: /^Firma$/ }).click();
    const sigCanvas = page.locator("canvas").filter({ hasNotText: "" }).first();
    // Fallback: select the canvas inside the dialog content
    const dialogCanvas = page.locator("[data-slot=dialog-content] canvas").first();
    const canvas = (await dialogCanvas.count()) > 0 ? dialogCanvas : sigCanvas;
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Signature canvas not visible");
    await page.mouse.move(box.x + box.width / 3, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + (box.width * 2) / 3, box.y + box.height / 2 + 5);
    await page.mouse.up();
    await page.getByRole("button", { name: /Aceptar/i }).click();
    await expect(page.locator("img[alt='Firma']")).toBeVisible();

    // 7) Toggle privacy checkbox; ensure it is checked
    await page.getByText(/He leído y acepto el\s+Aviso de Privacidad/i).click();
    await expect(page.locator("#privacy-accept")).toBeChecked();
  });
});

