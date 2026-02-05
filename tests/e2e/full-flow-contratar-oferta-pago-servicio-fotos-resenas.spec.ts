import { test, expect, APIRequestContext, Page } from "@playwright/test";

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

async function ensureConversation(
  request: APIRequestContext,
  baseURL: string | undefined,
  requestId: string,
  proId: string,
) {
  const prefix = baseURL ?? "";
  const res = await request.get(
    `${prefix}/api/conversations/ensure?requestId=${encodeURIComponent(requestId)}&proId=${encodeURIComponent(proId)}&redirect=false`,
    { headers: { "Content-Type": "application/json; charset=utf-8" } },
  );
  expect(res.ok(), "ensure conversation ok").toBeTruthy();
  const json = await res.json();
  const conversationId = (json?.id || json?.data?.id) as string | undefined;
  if (!conversationId) throw new Error("Missing conversation id");
  return conversationId;
}

test.describe("Full flow contratar - oferta - pago - finalizacion - resenas", () => {
  let SEED_OK = true;
  test.beforeAll(async ({ request, baseURL }) => {
    const prefix = baseURL ?? "";
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

  test("cliente contrata y confirma finalizacion", async ({ page, request, baseURL, context }) => {
    if (!SEED_OK) test.skip(true, "Seed unavailable (missing Supabase env). Skipping.");

    await loginWithMagicLink(page, request, baseURL, CLIENT_EMAIL);

    await page.goto(`/requests/${SEED_REQUEST_ID}`, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const aceptarBtn = page.getByRole("button", { name: /^Aceptar$/i }).first();
    if (await aceptarBtn.isVisible().catch(() => false)) {
      await aceptarBtn.click();
      const confirmDialog = page
        .locator('[data-slot="dialog-content"]')
        .filter({ hasText: /Aceptar postulaci[o\u00f3]n/i });
      if (await confirmDialog.isVisible().catch(() => false)) {
        await page.getByRole("button", { name: /^Confirmar$/i }).click();
      }
    }

    const montoInput = page.getByLabel(/Monto \(MXN\)/i).first();
    await expect(montoInput).toBeVisible();
    await montoInput.fill("1500");
    const crearAcuerdoBtn = page.getByRole("button", { name: /Crear acuerdo \(aceptado\)/i }).first();
    await expect(crearAcuerdoBtn).toBeVisible();
    await crearAcuerdoBtn.click();

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
    expect(proId, "professional id").toBeTruthy();

    const paidRes = await page.request.patch(`/api/agreements/${agreementId}`, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
      data: { status: "paid" },
    });
    expect(paidRes.ok(), "mark agreement paid").toBeTruthy();

    const scheduledRes = await page.request.patch(`/api/requests/${SEED_REQUEST_ID}`, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
      data: { status: "scheduled" },
    });
    expect(scheduledRes.ok(), "mark request scheduled").toBeTruthy();

    const conversationId = await ensureConversation(request, baseURL, SEED_REQUEST_ID, proId as string);

    const proPage = await context.newPage();
    await loginWithMagicLink(proPage, request, baseURL, PRO_EMAIL);

    await proPage.route("**/api/storage/presign", async (route) => {
      let path = "e2e";
      try {
        const body = await route.request().postDataJSON();
        if (body?.path) path = String(body.path);
      } catch {
        /* ignore */
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, path, url: "/__e2e_upload", publicUrl: `https://example.com/${encodeURIComponent(path)}` }),
      });
    });
    await proPage.route("**/__e2e_upload", async (route) => {
      await route.fulfill({ status: 200, body: "" });
    });

    await proPage.goto(`/mensajes/${conversationId}`, { waitUntil: "networkidle" });

    const finishBtn = proPage.getByRole("button", { name: /Trabajo finalizado/i }).first();
    await expect(finishBtn).toBeVisible({ timeout: 15000 });
    await finishBtn.click();

    const nextBtn = proPage.getByRole("button", { name: /Siguiente/i }).first();
    await expect(nextBtn).toBeVisible({ timeout: 15000 });
    await nextBtn.click();

    const photoInput = proPage.getByTestId("finish-job-photos");
    await expect(photoInput).toBeVisible({ timeout: 15000 });
    await photoInput.setInputFiles({
      name: "job.png",
      mimeType: "image/png",
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    });

    const finalizeBtn = proPage.getByRole("button", { name: /Finalizar/i }).first();
    await expect(finalizeBtn).toBeVisible({ timeout: 15000 });
    await finalizeBtn.click();

    await expect(proPage.getByText(/El profesional ha finalizado el trabajo/i)).toBeVisible({ timeout: 15000 });

    await page.goto(`/mensajes/${conversationId}`, { waitUntil: "networkidle" });
    await expect(page.getByText(/El profesional ha finalizado el trabajo/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: /Trabajo finalizado/i })).toHaveCount(0);

    const confirmBtn = page.getByRole("button", { name: /^Confirmar$/i });
    await expect(confirmBtn).toBeVisible({ timeout: 15000 });
    await confirmBtn.click();

    const submitReview = page.getByTestId("submit-review");
    await expect(submitReview).toBeVisible({ timeout: 15000 });
    await submitReview.click();

    const reqRes = await page.request.get(`/api/requests/${SEED_REQUEST_ID}`, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
    expect(reqRes.ok(), "request fetch ok").toBeTruthy();
    const reqJson = await reqRes.json();
    expect(reqJson?.data?.status).toBe("finished");

    await page.goto(`/profiles/${proId}`, { waitUntil: "domcontentloaded" });
    const works = page.getByRole("region", { name: /Trabajos realizados/i });
    await expect(works).toBeVisible({ timeout: 15000 });
    await expect(works.getByRole("img").first()).toBeVisible({ timeout: 15000 });
  });
});
