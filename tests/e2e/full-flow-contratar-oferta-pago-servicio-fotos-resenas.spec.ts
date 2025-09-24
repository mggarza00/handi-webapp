import { test, expect, APIRequestContext, Page, BrowserContext } from "@playwright/test";

// Seeded constants per app/api/test-seed
const SEED_REQUEST_ID = "33333333-3333-4333-8333-333333333333";
const CLIENT_EMAIL = "client+seed@handi.dev";
const PRO_EMAIL = "pro+seed@handi.dev";

async function loginWithMagicLink(
  page: Page,
  request: APIRequestContext,
  baseURL: string | undefined,
  email: string,
) {
  const prefix = baseURL ?? "";
  const res = await request.get(
    `${prefix}/api/test-auth/login?email=${encodeURIComponent(email)}&next=/`,
    { headers: { "Content-Type": "application/json; charset=utf-8" } },
  );
  expect(res.ok(), `login link for ${email}`).toBeTruthy();
  const payload = await res.json();
  const tokenHash = payload?.token_hash as string | undefined;
  const actionLink = payload?.action_link as string | undefined;
  if (tokenHash) {
    const type = (payload?.type as string | undefined) ?? "magiclink";
    const callbackUrl = `/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(type)}&next=${encodeURIComponent("/")}`;
    await page.goto(callbackUrl, { waitUntil: "networkidle" });
  } else if (actionLink) {
    await page.goto(actionLink, { waitUntil: "networkidle" });
  } else {
    throw new Error(`No magic link for ${email}`);
  }
  await page.waitForLoadState("networkidle");
}

test.describe("Flujo completo contratar → oferta → aceptar → pago → en proceso → finalizado → fotos → reseñas", () => {
  let SEED_OK = true;
  test.beforeAll(async ({ request, baseURL }) => {
    const prefix = baseURL ?? "";
    // reset + seed
    const r1 = await request.get(`${prefix}/api/test-seed?action=reset`, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
    if (!r1.ok()) {
      SEED_OK = false;
      return;
    }
    const r2 = await request.get(`${prefix}/api/test-seed?action=seed`, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
    if (!r2.ok()) {
      // eslint-disable-next-line no-console
      console.error("seed.error", r2.status(), await r2.text());
    }
    SEED_OK = r2.ok();
  });

  test("cliente contrata, crea acuerdo; pago simulado; pro confirma; cliente finaliza; sube fotos; reseña", async ({ page, request, baseURL, context }) => {
    if (!SEED_OK) test.skip(true, "Seed unavailable (missing Supabase env). Skipping.");
    // 1) Login cliente
    await loginWithMagicLink(page, request, baseURL, CLIENT_EMAIL);

    // 2) Ir al detalle de la solicitud seed
    await page.goto(`/requests/${SEED_REQUEST_ID}`, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // 3) Aceptar la postulación del profesional seed desde la UI
    const aceptarBtn = page.getByRole("button", { name: /^Aceptar$/i }).first();
    await expect(aceptarBtn).toBeVisible({ timeout: 15_000 });
    await aceptarBtn.click();
    const confirmDialog = page.locator('[data-slot="dialog-content"]').filter({ hasText: "Aceptar postulación" });
    await expect(confirmDialog).toBeVisible();
    await page.getByRole("button", { name: /^Confirmar$/i }).click();

    // 4) Crear acuerdo (aceptado) con monto
    const montoInput = page.getByLabel(/Monto \(MXN\)/i).first();
    await expect(montoInput).toBeVisible();
    await montoInput.fill("1500");
    const crearAcuerdoBtn = page.getByRole("button", { name: /Crear acuerdo \(aceptado\)/i }).first();
    await expect(crearAcuerdoBtn).toBeVisible();
    await crearAcuerdoBtn.click();

    // 5) Obtener el acuerdo creado para continuar el flujo
    const agrRes = await page.request.get(`/api/requests/${SEED_REQUEST_ID}/agreements`, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
    expect(agrRes.ok(), "agreements list ok").toBeTruthy();
    const agrJson = await agrRes.json();
    const agreements = (agrJson?.data ?? []) as Array<{ id: string; status?: string | null; professional_id?: string | null }>;
    expect(Array.isArray(agreements) && agreements.length > 0, "agreements created").toBeTruthy();
    const agreementId = agreements[0].id as string;
    const proId = (agreements[0].professional_id ?? null) as string | null;
    expect(agreementId, "agreement id").toBeTruthy();

    // 6) Simular pasarela de pago y poner la solicitud en proceso
    //    (evitamos Stripe real actualizando el acuerdo a paid + request a in_process)
    const paidRes = await page.request.patch(`/api/agreements/${agreementId}`, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
      data: { status: "paid" },
    });
    expect(paidRes.ok(), "mark agreement paid").toBeTruthy();

    const inProcessRes = await page.request.patch(`/api/requests/${SEED_REQUEST_ID}`, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
      data: { status: "in_process" },
    });
    expect(inProcessRes.ok(), "mark request in_process").toBeTruthy();

    // 7) Como profesional: ir a la página del servicio y confirmar (servicio en proceso)
    const proPage = await context.newPage();
    await loginWithMagicLink(proPage, request, baseURL, PRO_EMAIL);
    await proPage.goto(`/services/${agreementId}`, { waitUntil: "domcontentloaded" });
    // Botón de confirmar servicio (pro)
    const confirmarServicioBtn = proPage.getByRole("button", { name: /Confirmar servicio/i });
    await expect(confirmarServicioBtn).toBeVisible({ timeout: 15_000 });
    await confirmarServicioBtn.click();
    // Debe indicar que espera confirmación del cliente
    await expect(proPage.getByText(/Esperando la confirmacion del cliente|Esperando confirmaci[óo]n del cliente/i)).toBeVisible({ timeout: 15_000 });

    // 8) Como cliente: confirmar para finalizar el servicio
    const finalizeRes = await page.request.post(`/api/services/${agreementId}/confirm`, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
      data: { actor: "client" },
    });
    expect(finalizeRes.ok(), "client confirm service").toBeTruthy();

    // Verificar en la vista del pro que el servicio quedó completado
    await proPage.reload({ waitUntil: "domcontentloaded" });
    await expect(proPage.getByText(/Servicio finalizado por ambas partes|Completado/i)).toBeVisible({ timeout: 15_000 });

    // 9) (Opcional) Pago a profesional
    test.info().annotations.push({ type: "info", description: "Payout a profesional no implementado aún; paso verificado de forma conceptual." });

    // 10) Subir fotos del trabajo (como profesional)
    const photosRes = await proPage.request.post(`/api/requests/${SEED_REQUEST_ID}/photos`, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
      data: {
        urls: [
          "https://picsum.photos/seed/handi1/800/450",
          "https://picsum.photos/seed/handi2/800/450",
        ],
      },
    });
    expect(photosRes.ok(), "upload photos").toBeTruthy();
    await proPage.reload({ waitUntil: "domcontentloaded" });
    await expect(proPage.getByText(/Evidencias de trabajo/i)).toBeVisible();
    await expect(proPage.getByText(/Foto subida/i).first()).toBeVisible();

    // 11) Reseñas (cliente califica al profesional)
    expect(proId, "professional id for review").toBeTruthy();
    const reviewRes = await page.request.post(`/api/reviews`, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
      data: {
        request_id: SEED_REQUEST_ID,
        professional_id: proId,
        rating: 5,
        comment: `Reseña E2E ${Date.now()}`,
      },
    });
    expect(reviewRes.ok(), "submit review").toBeTruthy();

    // 12) Verificar que el perfil del pro refleja reseñas
    await page.goto(`/profiles/${proId}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/Reseñas de clientes|Sin reseñas aún/i)).toBeVisible();
    // Si muestra resumen, no debe decir "Sin reseñas aún"
    const hasReviews = await page.getByText(/Sin reseñas aún/i).count().catch(() => 0);
    expect(hasReviews).toBeLessThan(1);

    // Sanity: estado final del acuerdo completado
    const agrFinalRes = await page.request.get(`/api/requests/${SEED_REQUEST_ID}/agreements`, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
    expect(agrFinalRes.ok()).toBeTruthy();
    const agrFinal = await agrFinalRes.json();
    const finalStatus = (agrFinal?.data?.[0]?.status ?? null) as string | null;
    expect(finalStatus).toBe("completed");

    // Y la solicitud también completada (aseguramos estado para permitir reseña)
    const reqCompleted = await page.request.patch(`/api/requests/${SEED_REQUEST_ID}`, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
      data: { status: "completed" },
    });
    expect(reqCompleted.ok()).toBeTruthy();
  });
});
