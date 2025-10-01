import { test, expect } from '@playwright/test';

test.describe('Chat attachments (smoke)', () => {
  test('uploads and renders without full refresh (mocked network)', async ({ page }) => {
    const conversationId = '11111111-1111-1111-1111-111111111111';
    // Mock current user for /api/me
    await page.route('**/api/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: { id: 'user-1' } }),
      });
    });
    // History with no messages
    await page.route(`**/api/chat/history?conversationId=${conversationId}**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({ ok: true, data: [], participants: { customer_id: 'user-1', pro_id: 'user-2' } }),
      });
    });
    // requests meta
    await page.route('**/api/requests/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {} }) });
    });
    // Supabase storage upload mocked success
    await page.route('**/storage/v1/object/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });
    // Create message mocked
    await page.route('**/api/chat/send', async (route) => {
      const now = new Date().toISOString();
      await route.fulfill({
        status: 201,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({ ok: true, data: { id: 'msg-1', created_at: now } }),
      });
    });

    // Load chat page (mensajes) using our conversationId
    await page.goto(`/mensajes/${conversationId}`);

    // Click the attach button and set files on the hidden input
    const attachBtn = page.getByRole('button', { name: /Subir archivo|Adjuntar/i });
    await attachBtn.click();
    const fileChooserPromise = page.waitForEvent('filechooser').catch(() => null);
    // Some UIs won't trigger filechooser because input is hidden; instead set files directly
    const input = page.locator('input[type="file"]');
    await input.setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]) });

    // Expect progress to appear then finish
    await expect(page.locator('text=/\d+%/')).toBeVisible();

    // After mocked POST, the UI should update without refresh
    await expect(page.locator('img[alt="test.png"]')).toBeVisible({ timeout: 5000 });
  });
});
