import { test, expect } from "@playwright/test";
import {
  loginUI,
  seedE2EUsers,
  ensureRequestForChat,
  openRequestChat,
  sendMessage,
  expectLastMessage,
  openMessages,
  requireTestId,
  getFirstConversationId,
} from "./utils/chat";

test.describe("Chat en requests/[id] (cliente)", () => {
  test.setTimeout(120_000);
  test.beforeAll(async ({ baseURL, request }) => {
    await seedE2EUsers(request, baseURL);
    const c = await request.get(`/api/test-auth/login?email=${encodeURIComponent('cliente.e2e@handi.mx')}&next=/`);
    const p = await request.get(`/api/test-auth/login?email=${encodeURIComponent('pro.e2e@handi.mx')}&next=/`);
    if (!c.ok() || !p.ok()) test.skip(true, "Test auth endpoint unavailable (missing Supabase env). Skipping.");
  });

  test("ida y vuelta realtime en chat de solicitud", async ({ browser, page }) => {
    // CLIENTE
    await loginUI(page, "client");

    // PRO context
    const proContext = await browser.newContext();

    // Crea solicitud y postulación pro
    const { requestId } = await ensureRequestForChat(page, proContext);

    // Abrir chat de la solicitud (cliente)
    await openRequestChat(page, requestId);

    // Enviar desde cliente
    const msgClient = `Hola desde request chat ${Date.now()}`;
    await sendMessage(page, "request-chat", msgClient);

    // PRO: abrir la misma solicitud y chat
    const proPage = await proContext.newPage();
    await loginUI(proPage, "pro");
    // Verificar unread en mensajes antes de abrir
    await openMessages(proPage);
    await expect(proPage.getByTestId("chat-unread-badge").first()).toBeVisible({ timeout: 10_000 });
    // Abrir chat de la solicitud
    await proPage.goto(`/requests/${requestId}`, { waitUntil: "domcontentloaded" });
    await (await requireTestId(proPage, "open-request-chat")).click();
    await requireTestId(proPage, "request-chat-box");
    // Verificar recepción del mensaje cliente
    await expectLastMessage(proPage, "request-chat", "client", msgClient);

    // PRO responde
    const msgPro = `Recibido (pro) ${Date.now()}`;
    await sendMessage(proPage, "request-chat", msgPro);

    // CLIENTE ve respuesta
    await expectLastMessage(page, "request-chat", "pro", msgPro);

    // Typing indicator: PRO teclea, CLIENTE lo ve
    const inputPro = await requireTestId(proPage, "request-chat-input");
    await inputPro.fill("Escribiendo...");
    await expect(page.getByTestId("chat-typing-indicator")).toBeVisible({ timeout: 10_000 });

    // Scenario: oferta creada por cliente visible para pro sin refresh
    const conversationId = await getFirstConversationId(page);
    const offerTitle = `Oferta E2E ${Date.now()}`;
    const createOffer = await page.request.post(
      `/api/conversations/${encodeURIComponent(conversationId)}/offers`,
      {
        headers: { "Content-Type": "application/json; charset=utf-8" },
        data: {
          title: offerTitle,
          description: "Oferta de prueba realtime",
          amount: 750,
          currency: "MXN",
        },
      },
    );
    expect(createOffer.ok()).toBeTruthy();
    await expectLastMessage(proPage, "request-chat", "client", offerTitle);

    // Scenario: aceptacion de oferta visible para cliente sin refresh
    const offerJson = await createOffer.json().catch(() => ({} as any));
    const offerId = offerJson?.offer?.id as string | undefined;
    expect(offerId).toBeTruthy();
    const acceptOffer = await proPage.request.post(
      `/api/offers/${encodeURIComponent(String(offerId))}/accept`,
      {
        headers: { "Content-Type": "application/json; charset=utf-8" },
        data: { conversationId },
      },
    );
    expect(acceptOffer.ok()).toBeTruthy();
    await expect(page.getByText("Oferta aceptada").last()).toBeVisible({
      timeout: 15_000,
    });
  });
});
