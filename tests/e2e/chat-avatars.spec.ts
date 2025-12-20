import { test, expect } from "@playwright/test";
import { loginUI, seedE2EUsers, ensureRequestForChat, openMessages } from "./utils/chat";

test.describe("Avatares en listado de chats (/mensajes)", () => {
  test.setTimeout(120_000);

  test.beforeAll(async ({ baseURL, request }) => {
    await seedE2EUsers(request, baseURL);
    const c = await request.get(`/api/test-auth/login?email=${encodeURIComponent('cliente.e2e@handi.mx')}&next=/`);
    const p = await request.get(`/api/test-auth/login?email=${encodeURIComponent('pro.e2e@handi.mx')}&next=/`);
    if (!c.ok() || !p.ok()) test.skip(true, "Test auth endpoint unavailable (missing Supabase env). Skipping.");
  });

  test("muestra un <img> con src válido en el item de chat", async ({ browser, page }) => {
    // Login cliente
    await loginUI(page, "client");

    // Garantizar que exista al menos una conversación
    const proContext = await browser.newContext();
    await ensureRequestForChat(page, proContext);

    // Abrir bandeja de mensajes
    await openMessages(page);

    // Tomar el primer hilo y validar avatar <img>
    const firstThread = page.getByTestId("chat-thread-item").first();
    await expect(firstThread).toBeVisible({ timeout: 10_000 });
    const img = firstThread.locator("img").first();
    await expect(img).toBeVisible({ timeout: 10_000 });
    const src = await img.getAttribute("src");
    expect(src && src.trim().length > 0).toBeTruthy();
  });
});

