import { test, expect } from "@playwright/test";

test.describe("Requests + Applications (seed dev/CI)", () => {
  test.beforeAll(async ({ request, baseURL }) => {
    // reset + seed
    const r1 = await request.get(`${baseURL}/api/test-seed?action=reset`, { headers: { "Content-Type": "application/json; charset=utf-8" } });
    expect(r1.ok()).toBeTruthy();
    const r2 = await request.get(`${baseURL}/api/test-seed?action=seed`, { headers: { "Content-Type": "application/json; charset=utf-8" } });
    expect(r2.ok()).toBeTruthy();
  });

  test("Listado muestra la solicitud seed activa", async ({ page }) => {
    await page.goto("/requests");
    // busca por el título del seed
    await expect(page.getByText(/Instalación eléctrica \(seed\)/i)).toBeVisible({ timeout: 10000 });
  });

  test("Unicidad de postulaciones por (request_id, professional_id)", async ({ request, baseURL }) => {
    const res = await request.get(`${baseURL}/api/test-seed?action=apply-twice`, { headers: { "Content-Type": "application/json; charset=utf-8" } });
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    // el segundo insert debió fallar con 23505 en Postgres
    expect(json.ok).toBeTruthy();
    expect(json.dupCode).toBe("23505");
  });

  test("UI muestra CTA 'Postularme' cuando simulo rol 'professional'", async ({ page }) => {
    // set rol de prueba (solo dev/CI)
    await page.goto("/api/test-auth/professional");
    await page.goto("/requests/33333333-3333-4333-8333-333333333333", { waitUntil: "domcontentloaded" });
    // no hacemos click (el flujo real requiere sesión Supabase),
    // solo validamos que el CTA exista para este rol
    await expect(page.getByText(/Postularme/i)).toBeVisible();
  });
});
