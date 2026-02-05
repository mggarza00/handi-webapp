import { test, expect, BrowserContext } from '@playwright/test';
import { seedE2EUsers, loginUI, ensureRequestForChat, openRequestChat } from './utils/chat';

async function createOfferForConversation(page, conversationId: string, amount = 1200) {
  const res = await page.request.post(`/api/conversations/${encodeURIComponent(conversationId)}/offers`, {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    data: { title: 'Trabajo', amount, currency: 'MXN' },
  });
  expect(res.ok(), 'create offer ok').toBeTruthy();
}

async function acceptOfferForConversationAsPro(proContext: BrowserContext, conversationId: string) {
  const proPage = await proContext.newPage();
  await loginUI(proPage, 'pro');
  const res = await proPage.request.post(`/api/conversations/${encodeURIComponent(conversationId)}/offers/accept`, {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    data: { conversationId },
  });
  expect(res.ok(), 'accept offer ok').toBeTruthy();
  await proPage.close();
}

async function getConversationIdFromFirstThread(page): Promise<string> {
  const first = page.getByTestId('chat-thread-item').first();
  await expect(first).toBeVisible({ timeout: 15000 });
  await first.click();
  const m = page.url().match(/\/mensajes\/([0-9a-f\-]{36})/i);
  expect(m, 'conversation id in URL').not.toBeNull();
  return m![1];
}

test.describe('Chat CTAs hidden after payment and request scheduled', () => {
  test.setTimeout(120_000);
  test.beforeAll(async ({ baseURL, request }) => {
    await seedE2EUsers(request, baseURL);
    const c = await request.get(`/api/test-auth/login?email=${encodeURIComponent('cliente.e2e@handi.mx')}&next=/`);
    const p = await request.get(`/api/test-auth/login?email=${encodeURIComponent('pro.e2e@handi.mx')}&next=/`);
    if (!c.ok() || !p.ok()) test.skip(true, 'Test auth unavailable');
  });

  test('hide pay/contract buttons and schedule request', async ({ browser, page }) => {
    // Login client and ensure a request + conversation exists
    await loginUI(page, 'client');
    const proContext = await browser.newContext();
    const { requestId } = await ensureRequestForChat(page, proContext);

    // Abrir el chat de la solicitud para asegurar conversación
    await openRequestChat(page, requestId);
    // Abrir inbox y entrar al primer thread para obtener conversationId
    await page.goto('/mensajes', { waitUntil: 'domcontentloaded' });
    const conversationId = await getConversationIdFromFirstThread(page);

    // Create offer (client) and accept it (pro)
    await createOfferForConversation(page, conversationId, 1500);
    await acceptOfferForConversationAsPro(proContext, conversationId);

    // Resolve offer id and mark it as paid via test endpoint
    const off = await page.request.get(`/api/conversations/${encodeURIComponent(conversationId)}/offers`);
    expect(off.ok(), 'list offers ok').toBeTruthy();
    const j = await off.json();
    const offerId: string | undefined = j?.data?.[0]?.id;
    expect(offerId, 'offer id exists').toBeTruthy();
    const mark = await page.request.post(`/api/test/offers/${encodeURIComponent(offerId!)}/mark-paid`, { headers: { 'x-e2e': '1' } });
    expect(mark.ok(), 'mark paid ok').toBeTruthy();

    // Wait for paid message to show
    await expect(page.getByText('Pago realizado. Servicio agendado.').first()).toBeVisible({ timeout: 15000 });

    // CTAs should be hidden for the client
    await expect(page.getByRole('button', { name: 'Continuar al pago' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Contratar' })).toHaveCount(0);

    // Request should be scheduled in backend
    const statusRes = await page.request.get(`/api/requests/${encodeURIComponent(requestId)}/status`);
    expect(statusRes.ok(), 'request status endpoint ok').toBeTruthy();
    const statusJson = await statusRes.json();
    expect(statusJson?.data?.status).toBe('scheduled');

    // Agreements summary should show only one item with "Servicio agendado"
    await page.goto(`/requests/${requestId}`, { waitUntil: 'domcontentloaded' });
    const agreementsCard = page.locator('div', {
      has: page.getByRole('heading', { name: 'Acuerdos' }),
    }).first();
    await expect(agreementsCard).toBeVisible({ timeout: 15000 });
    const agreementItems = agreementsCard.locator('li');
    await expect(agreementItems).toHaveCount(1);
    await expect(agreementsCard.getByText('Servicio agendado')).toBeVisible();

    // Pro dashboard should show an in-progress service
    const proPage = await proContext.newPage();
    await loginUI(proPage, 'pro');
    await proPage.goto('/pro', { waitUntil: 'domcontentloaded' });
    const inProcessCard = proPage
      .locator('div', { has: proPage.getByRole('heading', { name: 'En proceso' }) })
      .first();
    await expect(inProcessCard).toBeVisible({ timeout: 15000 });
    await expect(inProcessCard.getByText('Sin servicios en proceso.')).toHaveCount(0);

    // Pro calendar should list the scheduled service
    await proPage.goto('/pro/calendar', { waitUntil: 'domcontentloaded' });
    await expect(proPage.getByText('Mi calendario')).toBeVisible({ timeout: 15000 });
    await expect(proPage.getByText('No hay servicios agendados.')).toHaveCount(0);
    await proPage.close();
  });
});
