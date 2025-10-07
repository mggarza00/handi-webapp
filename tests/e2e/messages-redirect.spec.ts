import { test, expect } from '@playwright/test';

// Verifica que las rutas legacy /messages redirigen a /mensajes

test('redirects /messages to /mensajes', async ({ page }) => {
  await page.goto('/messages', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/mensajes$/);
});

test('redirects /messages/:id to /mensajes/:id', async ({ page }) => {
  const cid = 'e2e-conv-redirect';
  await page.goto(`/messages/${cid}`, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(new RegExp(`/mensajes/${cid}$`));
});
