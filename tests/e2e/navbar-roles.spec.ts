import { test, expect } from '@playwright/test';

const roles = ['guest','client','professional','admin'] as const;

for (const role of roles) {
  test(`navbar para rol: ${role}`, async ({ page }) => {
    await page.goto(`/api/test-auth/${role}`);
    await page.goto(`/`, { waitUntil: 'domcontentloaded' });

    const header = page.locator('header');
    await expect(header).toBeVisible({ timeout: 10000 });

    if (role === 'guest') {
      await expect(page.locator('[data-testid="btn-login"]')).toBeVisible();
      await expect(page.locator('[data-testid="btn-apply"]')).toBeVisible();
      await expect(page.locator('[data-testid="avatar"]')).toHaveCount(0);
    } else {
      await expect(page.locator('[data-testid="btn-login"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="avatar"]')).toBeVisible();
    }

    if (role === 'client') {
      await expect(page.locator('[data-testid="nav-client"]')).toBeVisible();
      await expect(page.locator('[data-testid="nav-professional"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="nav-admin"]')).toHaveCount(0);
    }
    if (role === 'professional') {
      await expect(page.locator('[data-testid="nav-professional"]')).toBeVisible();
      await expect(page.locator('[data-testid="nav-client"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="nav-admin"]')).toHaveCount(0);
    }
    if (role === 'admin') {
      await expect(page.locator('[data-testid="nav-admin"]')).toBeVisible();
      await expect(page.locator('[data-testid="nav-client"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="nav-professional"]')).toHaveCount(0);
    }
  });
}
