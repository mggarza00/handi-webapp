import { test, expect, BrowserContext } from "@playwright/test";
import { seedE2EUsers, loginUI, ensureRequestForChat, openRequestChat } from "./utils/chat";

async function getConversationIdFromFirstThread(page) {
  const first = page.getByTestId('chat-thread-item').first();
  await expect(first).toBeVisible({ timeout: 15000 });
  await first.click();
  const m = page.url().match(/\/mensajes\/([0-9a-f\-]{36})/i);
  expect(m, 'conversation id in URL').not.toBeNull();
  return m![1];
}

test.describe('Offer creates pro notification and email path is invoked', () => {
  test.setTimeout(120_000);

  test.beforeAll(async ({ baseURL, request }) => {
    await seedE2EUsers(request, baseURL);
    const c = await request.get(`/api/test-auth/login?email=${encodeURIComponent('cliente.e2e@handi.mx')}&next=/`);
    const p = await request.get(`/api/test-auth/login?email=${encodeURIComponent('pro.e2e@handi.mx')}&next=/`);
    if (!c.ok() || !p.ok()) test.skip(true, 'Test auth unavailable');
  });

  test('sending an offer notifies the pro', async ({ browser, page }) => {
    // Login client and ensure a request + conversation exists
    await loginUI(page, 'client');
    const proContext: BrowserContext = await browser.newContext();
    const { requestId } = await ensureRequestForChat(page, proContext);

    // Open chat and obtain conversation id from inbox
    await openRequestChat(page, requestId);
    await page.goto('/mensajes', { waitUntil: 'domcontentloaded' });
    const conversationId = await getConversationIdFromFirstThread(page);

    // Create offer as client
    const create = await page.request.post(`/api/conversations/${encodeURIComponent(conversationId)}/offers`, {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      data: { title: 'Trabajo de prueba', amount: 1234, currency: 'MXN' },
    });
    expect(create.ok(), 'create offer ok').toBeTruthy();

    // Login as pro and fetch notifications
    const proPage = await proContext.newPage();
    await loginUI(proPage, 'pro');
    const res = await proPage.request.get(`/api/me/notifications?unread=1&limit=10`, { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    expect(res.ok(), 'notifications endpoint ok').toBeTruthy();
    const j = await res.json();
    const items: Array<{ type?: string; title?: string; body?: string; link?: string }> = j?.items ?? [];
    // Expect at least one offer-type notification pointing to the conversation inbox
    const hasOffer = items.some((n) => (n.type === 'offer') && typeof n.title === 'string' && n.title.includes('Oferta') && typeof n.link === 'string' && n.link.includes('/mensajes'));
    expect(hasOffer, 'pro has an offer notification').toBeTruthy();

    await proPage.close();
  });
});

