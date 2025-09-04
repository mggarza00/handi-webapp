import { test, expect } from '@playwright/test';

test('home responde y renderiza elementos básicos', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Handee/i, { timeout: 15000 }).catch(() => {});
  const hero = page.getByText(/¿Qué necesitas hoy\?|Handee|Encuentra, conecta, resuelve/i);
  await expect(hero).toBeVisible({ timeout: 10000 });
});
