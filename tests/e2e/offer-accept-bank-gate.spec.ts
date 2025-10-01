import { test, expect } from '@playwright/test';

test.describe('bank gate', () => {
  test('gate aparece sin cuenta confirmada', async ({ page }) => {
    // Mock bank account: no confirmed on GET, confirm on POST
    await page.route('**/api/me/bank-account', async (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, json: { ok: true, account: null, hasConfirmed: false } });
      }
      // POST: confirm
      return route.fulfill({ status: 201, json: { ok: true, account: { status: 'confirmed' } } });
    });
    // Accept endpoint OK
    await page.route('**/api/offers/*/accept', async (route) => {
      return route.fulfill({ status: 200, json: { ok: true, checkoutUrl: null } });
    });
    // History + me minimal mocks to render chat
    await page.route('**/api/chat/history**', async (route) => {
      const url = new URL(route.request().url());
      const convId = url.searchParams.get('conversationId') || 'conv-e2e';
      return route.fulfill({ status: 200, json: { ok: true, data: [
        { id: 'msg1', sender_id: 'pro-1', body: '', created_at: new Date().toISOString(), message_type: 'offer', payload: { offer_id: 'off-1', status: 'pending', title: 'Trabajo', amount: 1000, currency: 'MXN' } }
      ] } });
    });
    await page.route('**/api/me', async (route) => {
      return route.fulfill({ status: 200, json: { ok: true, user: { id: 'pro-1', email: 'pro@test.local' } } });
    });

    await page.goto('/mensajes/e2e-conv');
    await page.getByTestId('accept-offer').first().click();

    // Modal visible (by form labels)
    await expect(page.getByLabel('Titular de la cuenta')).toBeVisible();
    await expect(page.getByLabel('CLABE (18 dígitos)')).toBeVisible();

    // Guardar datos válidos
    await page.getByLabel('Titular de la cuenta').fill('Juan Pérez');
    await page.getByLabel('CLABE (18 dígitos)').fill('002010077777777771');
    await page.getByTestId('save-bank').click();

    // Estado listo
    await expect(page.getByText('¡Cuenta bancaria lista!')).toBeVisible();
    await page.getByTestId('accept-offer-after-bank').click();
  });

  test('acepta directo con cuenta confirmada', async ({ page }) => {
    await page.route('**/api/me/bank-account', async (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, json: { ok: true, account: { status: 'confirmed' }, hasConfirmed: true } });
      }
      return route.fulfill({ status: 405, json: { ok: false, error: 'method_not_allowed' } });
    });
    await page.route('**/api/offers/*/accept', async (route) => {
      return route.fulfill({ status: 200, json: { ok: true, checkoutUrl: null } });
    });
    await page.route('**/api/chat/history**', async (route) => {
      const url = new URL(route.request().url());
      const convId = url.searchParams.get('conversationId') || 'conv-e2e';
      return route.fulfill({ status: 200, json: { ok: true, data: [
        { id: 'msg1', sender_id: 'pro-1', body: '', created_at: new Date().toISOString(), message_type: 'offer', payload: { offer_id: 'off-2', status: 'pending', title: 'Trabajo', amount: 1000, currency: 'MXN' } }
      ] } });
    });
    await page.route('**/api/me', async (route) => {
      return route.fulfill({ status: 200, json: { ok: true, user: { id: 'pro-1', email: 'pro@test.local' } } });
    });

    await page.goto('/mensajes/e2e-conv');
    await page.getByTestId('accept-offer').first().click();

    // Sin modal (no aparecen labels del formulario)
    await expect(page.getByLabel('Titular de la cuenta')).toHaveCount(0);
  });
});

