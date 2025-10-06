import { expect, Page, APIRequestContext, Browser, BrowserContext } from "@playwright/test";

export const CLIENT_EMAIL = "cliente.e2e@homaid.mx";
export const CLIENT_PASSWORD = "E2e!Pass123";
export const PRO_EMAIL = "pro.e2e@homaid.mx";
export const PRO_PASSWORD = "E2e!Pass123";

export async function requireTestId(page: Page, id: string, timeout = 10_000) {
  const loc = page.getByTestId(id);
  try {
    await expect(loc, `Missing required data-testid='${id}'`).toBeVisible({ timeout });
  } catch {
    throw new Error(`UI element with data-testid='${id}' not found. Add it to the UI to enable E2E.`);
  }
  return loc;
}

export async function loginUI(page: Page, role: "client" | "pro") {
  page.setDefaultTimeout(60_000);
  page.setDefaultNavigationTimeout(60_000);
  const email = role === "client" ? CLIENT_EMAIL : PRO_EMAIL;
  const base = process.env.E2E_BASE_URL || "http://localhost:3000";
  // Try magic link first (preferred), otherwise fallback to cookie-based dev login
  try {
    const res = await page.request.get(`/api/test-auth/login?email=${encodeURIComponent(email)}&role=${role}&next=/`);
    if (res.ok()) {
      const j = await res.json().catch(() => ({} as any));
      const tokenHash = (j?.token_hash as string | undefined) ?? undefined;
      const actionLink = (j?.action_link as string | undefined) ?? undefined;
      const type = (j?.type as string | undefined) ?? "magiclink";
      if (tokenHash) {
        const url = `/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(type)}&next=${encodeURIComponent("/")}`;
        await page.goto(url, { waitUntil: 'networkidle' });
      } else if (actionLink) {
        await page.goto(actionLink, { waitUntil: 'networkidle' });
      } else {
        // Fallback: hitting the endpoint directly sets a dev cookie
        await page.goto(`${base}/api/test-auth/login?email=${encodeURIComponent(email)}&role=${role}`, { waitUntil: 'domcontentloaded' });
      }
    } else {
      await page.goto(`${base}/api/test-auth/login?email=${encodeURIComponent(email)}&role=${role}`, { waitUntil: 'domcontentloaded' });
    }
  } catch {
    await page.goto(`${base}/api/test-auth/login?email=${encodeURIComponent(email)}&role=${role}`, { waitUntil: 'domcontentloaded' });
  }
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
  let ok = false;
  try {
    const me = await page.request.get(`/api/me`, { headers: { "Content-Type": "application/json; charset=utf-8" } });
    const mj = await me.json().catch(() => ({} as any));
    ok = me.ok() && !!mj?.user?.id;
  } catch {
    ok = false;
  }
  if (!ok) {
    // Fallback: just make sure cookie exists in the browser context
    const origin = new URL(base);
    const jar = await page.context().cookies();
    const hasCookie = jar.some((c) => c.name === "e2e_session");
    if (!hasCookie) {
      await page.context().addCookies([
        {
          name: "e2e_session",
          value: `${encodeURIComponent(email)}:${encodeURIComponent(role)}`,
          domain: origin.hostname,
          path: "/",
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
    }
  }
}

export async function seedE2EUsers(request: APIRequestContext, baseURL?: string) {
  const prefix = baseURL ?? "";
  await request.get(`${prefix}/api/test-seed?action=seed-e2e-users`, {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  }).catch(() => undefined);
}

export async function ensureRequestForChat(page: Page, proContext: BrowserContext): Promise<{ requestId: string }> {
  // Try to create via API first (faster when backend is ready)
  const payload = {
    title: `Instalación eléctrica cocina ${Date.now()}`,
    description: "Instalar 6 contactos y 2 lámparas",
    city: "Monterrey",
    category: "Electricidad",
    subcategories: ["Instalaciones"],
  } as const;
  let requestId: string | undefined;
  try {
    // Obtain real client/pro IDs from seed to allow x-user-id header
    const seed = await page.request.get(`/api/test-seed?action=seed-e2e-users`, { headers: { "Content-Type": "application/json; charset=utf-8" } });
    const sj = await seed.json().catch(() => ({} as any));
    const clientIdFromSeed: string | undefined = sj?.client_id;
    const res = await page.request.post(`/api/requests`, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...(clientIdFromSeed ? { "x-user-id": clientIdFromSeed } : {}),
      },
      data: payload,
    });
    if (res.ok()) {
      const j = await res.json().catch(() => ({} as any));
      requestId = (j?.data?.id ?? undefined) as string | undefined;
    }
  } catch {
    // ignore; will fallback to UI
  }
  if (!requestId) {
    // UI fallback path (works even if API auth isn’t wired)
    const base = process.env.E2E_BASE_URL || "http://localhost:3000";
    await page.goto(`${base}/requests/new`, { waitUntil: "domcontentloaded" });
    await (await requireTestId(page, "request-title")).fill("Instalación eléctrica cocina");
    await (await requireTestId(page, "request-desc")).fill("Instalar 6 contactos y 2 lámparas");
    try {
      const catTrigger = await requireTestId(page, "request-category", 2000);
      await catTrigger.click();
      await page.locator("[role=option]").first().click();
    } catch {
      // optional in some builds
    }
    await (await requireTestId(page, "post-request")).click();
    await page.waitForURL(/\/requests\/.+$/, { timeout: 30_000 });
    requestId = page.url().split("/").pop()!;
  }

  // Pro applies to request (or ensure conversation if applications API not available)
  const proPage = await proContext.newPage();
  await loginUI(proPage, "pro");
  const apply = await proPage.request.post(`/api/applications`, {
    headers: { "Content-Type": "application/json; charset=utf-8" },
    data: { request_id: requestId, note: "E2E ready" },
  });
  // Ensure the conversation exists regardless of applications API success
  try {
    // Prefer seeded pro UUID to avoid relying on /api/me from pro context
    const seed = await page.request.get(`/api/test-seed?action=seed-e2e-users`, { headers: { "Content-Type": "application/json; charset=utf-8" } });
    const sj = await seed.json().catch(() => ({} as any));
    let proIdEns: string | undefined = sj?.pro_id;
    if (!proIdEns) {
      const mePro = await proPage.request.get(`/api/me`, { headers: { "Content-Type": "application/json; charset=utf-8" } });
      const mj = await mePro.json().catch(() => ({} as any));
      proIdEns = mj?.user?.id;
    }
    if (proIdEns) {
      await page.request.post(`/api/conversations/ensure`, {
        headers: { "Content-Type": "application/json; charset=utf-8" },
        data: { requestId, proId: proIdEns, redirect: false },
      }).catch(() => undefined);
    }
  } catch {
    // ignore; conversation can still start from UI
  }
  await proPage.close();
  return { requestId };
}

export async function openRequestChat(page: Page, requestId: string) {
  await page.goto(`/requests/${requestId}`, { waitUntil: "domcontentloaded" });
  // Selecciona el peer si el selector está presente (espera hasta 10s)
  const peerSelect = page.locator('select').first();
  try {
    await peerSelect.waitFor({ state: 'visible', timeout: 10_000 });
    const nonEmpty = peerSelect.locator('option[value]');
    const count = await nonEmpty.count();
    for (let i = 0; i < count; i++) {
      const v = await nonEmpty.nth(i).getAttribute('value');
      if (v && v.trim().length > 0) { await peerSelect.selectOption(v).catch(() => undefined); break; }
    }
  } catch { /* ignore */ }
  // Abre chat embebido si el botón existe; si no, haz fallback a inbox
  try {
    const openBtn = await requireTestId(page, "open-request-chat", 3000);
    await openBtn.click();
  } catch {
    // Fallback: abre inbox y entra al primer hilo
    await openMessages(page);
    const firstThread = page.getByTestId("chat-thread-item").first();
    await expect(firstThread).toBeVisible({ timeout: 10_000 });
    await firstThread.click();
    return; // en inbox usamos prefijo "chat"; sendMessage/expectLastMessage manejarán el fallback de prefijo
  }
  // Si no aparece el box, fuerza la creación de la conversación vía API y reintenta
  try {
    await requireTestId(page, "request-chat-box", 5000);
  } catch {
    try {
      const apps = await page.request.get(`/api/requests/${requestId}/applications`, {
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
      const j = await apps.json();
      const proId: string | undefined = j?.data?.[0]?.professional_id;
      if (proId) {
        await page.request.post(`/api/chat/start`, {
          headers: { "Content-Type": "application/json; charset=utf-8" },
          data: { requestId, proId },
        }).catch(() => undefined);
      }
    } catch { /* ignore */ }
    // Reintenta abrir
    try {
      const reOpen = await requireTestId(page, "open-request-chat", 2000);
      await reOpen.click().catch(() => undefined);
    } catch {}
    await requireTestId(page, "request-chat-box");
  }
}

export async function openMessages(page: Page) {
  const hasLink = await page.getByTestId("open-messages-link").count();
  if (hasLink) {
    await page.getByTestId("open-messages-link").click();
    try {
      await requireTestId(page, "chat-thread-list");
      return;
    } catch {}
  }
  // Fallback: direct navigation to /messages or /mensajes
  try {
    await page.goto("/messages", { waitUntil: "domcontentloaded" });
    await requireTestId(page, "chat-thread-list");
  } catch {
    await page.goto("/mensajes", { waitUntil: "domcontentloaded" });
    await requireTestId(page, "chat-thread-list");
  }
}

export async function sendMessage(page: Page, prefix: "chat" | "request-chat", text: string) {
  async function trySend(pfx: "chat" | "request-chat"): Promise<boolean> {
    try {
      const input = await requireTestId(page, `${pfx}-input`, 3000);
      await input.fill(text);
      const send = await requireTestId(page, `${pfx}-send`, 3000);
      await send.click();
      return true;
    } catch {
      return false;
    }
  }
  if (!(await trySend(prefix))) {
    const alt = prefix === "chat" ? "request-chat" : "chat";
    if (!(await trySend(alt))) throw new Error(`No chat input found for prefixes: ${prefix}, ${alt}`);
  }
}

export async function expectLastMessage(page: Page, prefix: "chat" | "request-chat", author: "client" | "pro", text: string) {
  async function getLocator(pfx: "chat" | "request-chat") {
    return page.locator(`[data-testid="${pfx}-message"][data-author="${author}"]`).last();
  }
  const loc1 = await getLocator(prefix);
  if (await loc1.count().catch(() => 0)) {
    await expect(loc1, `Expected last message by ${author} containing '${text}'`).toContainText(text, { timeout: 10_000 });
    return;
  }
  const alt = prefix === "chat" ? "request-chat" : "chat";
  const loc2 = await getLocator(alt);
  await expect(loc2, `Expected last message by ${author} containing '${text}' (prefix fallback)`).toContainText(text, { timeout: 10_000 });
}
