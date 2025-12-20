import { test, expect } from "@playwright/test";

test.describe("Requests + Applications (seed dev/CI)", () => {
  let SEED_OK = true;
  test.beforeAll(async ({ request, baseURL }) => {
    // reset + seed
    const r1 = await request.get(`${baseURL}/api/test-seed?action=reset`, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
    if (!r1.ok()) {
      SEED_OK = false;
      return;
    }
    const r2 = await request.get(`${baseURL}/api/test-seed?action=seed`, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
    SEED_OK = r2.ok();
  });

  test("Listado muestra la solicitud seed activa", async ({ page, request }) => {
    if (!SEED_OK) test.skip(true, "Seed unavailable (missing Supabase env). Skipping.");
    // Inicia sesión como cliente seed para ver sus propias solicitudes
    const r = await request.get(`/api/test-auth/login?email=${encodeURIComponent("client+seed@handi.dev")}&next=/`);
    if (r.ok()) {
      const payload = await r.json();
      if (payload?.token_hash) {
        const type = payload?.type || "magiclink";
        await page.goto(`/auth/callback?token_hash=${encodeURIComponent(payload.token_hash)}&type=${encodeURIComponent(type)}&next=/`, { waitUntil: "networkidle" });
      } else if (payload?.action_link) {
        await page.goto(payload.action_link, { waitUntil: "networkidle" });
      }
    }

    await page.goto("/requests?mine=1");
    // busca por el título del seed
    await expect(page.getByText(/Instalación eléctrica \(seed\)/i)).toBeVisible(
      { timeout: 10000 },
    );
  });

  test("Unicidad de postulaciones por (request_id, professional_id)", async ({
    request,
    baseURL,
  }) => {
    if (!SEED_OK) test.skip(true, "Seed unavailable (missing Supabase env). Skipping.");
    const res = await request.get(
      `${baseURL}/api/test-seed?action=apply-twice`,
      { headers: { "Content-Type": "application/json; charset=utf-8" } },
    );
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    // el segundo insert debió fallar con 23505 en Postgres
    expect(json.ok).toBeTruthy();
    expect(json.dupCode).toBe("23505");
  });

  test("Vista de detalle responde con navegación PRO al simular rol 'professional'", async ({
    page, context, baseURL,
  }) => {
    if (!SEED_OK) test.skip(true, "Seed unavailable (missing Supabase env). Skipping.");
    // Simula rol de prueba mediante cookie (equivalente al endpoint /api/test-auth/professional)
    await context.clearCookies();
    const origin = new URL(baseURL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100");
    await context.addCookies([
      {
        name: "handi_role",
        value: "professional",
        domain: origin.hostname,
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    await page.goto("/requests/33333333-3333-4333-8333-333333333333", {
      waitUntil: "domcontentloaded",
    });
    // Validamos el contexto de navegación para PRO (header)
    await expect(page.locator('[data-testid="nav-professional"]')).toBeVisible();
  });
});
