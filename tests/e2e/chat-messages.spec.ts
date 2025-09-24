import { test, expect } from "@playwright/test";
import {
  loginUI,
  seedE2EUsers,
  ensureRequestForChat,
  openRequestChat,
  openMessages,
  sendMessage,
  expectLastMessage,
  requireTestId,
} from "./utils/chat";

test.describe("Chat global en /messages (cliente)", () => {
  test.setTimeout(120_000);
  test.beforeAll(async ({ baseURL, request }) => {
    await seedE2EUsers(request, baseURL);
    const c = await request.get(`/api/test-auth/login?email=${encodeURIComponent('cliente.e2e@handi.mx')}&next=/`);
    const p = await request.get(`/api/test-auth/login?email=${encodeURIComponent('pro.e2e@handi.mx')}&next=/`);
    if (!c.ok() || !p.ok()) test.skip(true, "Test auth endpoint unavailable (missing Supabase env). Skipping.");
  });

  test("inbox realtime, unread toggles, y consistencia con request chat", async ({ browser, page }) => {
    // CLIENTE
    await loginUI(page, "client");
    const proContext = await browser.newContext();

    // Asegurar una solicitud y conversación
    const { requestId } = await ensureRequestForChat(page, proContext);
    // Abre una vez el chat de la solicitud para asegurar conversación
    await openRequestChat(page, requestId);

    // CLIENTE: abrir mensajes globales e ingresar al primer thread
    await openMessages(page);
    const firstThread = page.getByTestId("chat-thread-item").first();
    await expect(firstThread).toBeVisible({ timeout: 10_000 });
    // Título presente
    await expect(firstThread.getByTestId("chat-thread-title")).toBeVisible();
    await firstThread.click();

    // Enviar desde inbox (cliente)
    const msgClient = `Hola desde inbox (cliente) ${Date.now()}`;
    await sendMessage(page, "chat", msgClient);

    // PRO: abrir /messages, verificar unread y entrar al mismo hilo (primero)
    const proPage = await proContext.newPage();
    await loginUI(proPage, "pro");
    await openMessages(proPage);
    // Antes de abrir, intenta capturar unread (si la UI lo soporta)
    const unreadBefore = await proPage.getByTestId("chat-unread-badge").count().catch(() => 0);
    const firstThreadPro = proPage.getByTestId("chat-thread-item").first();
    await firstThreadPro.click();

    // Verificar mensaje de cliente en el hilo global del PRO
    await expectLastMessage(proPage, "chat", "client", msgClient);

    // PRO responde
    const msgPro = `Listo ${Date.now()}`;
    await sendMessage(proPage, "chat", msgPro);

    // CLIENTE visualiza respuesta en inbox
    await expectLastMessage(page, "chat", "pro", msgPro);

    // Unread badge debería disminuir al leer (si existía)
    await openMessages(proPage);
    const unreadAfter = await proPage.getByTestId("chat-unread-badge").count().catch(() => 0);
    if (unreadBefore > 0) {
      expect(unreadAfter).toBeLessThan(unreadBefore);
    }

    // Consistencia: el mensaje enviado en /messages aparece en /requests/[id]
    await openRequestChat(page, requestId);
    await expectLastMessage(page, "request-chat", "pro", msgPro);
  });
});
