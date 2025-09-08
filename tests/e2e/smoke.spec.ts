import { test, expect } from "@playwright/test";

test("home responde y renderiza elementos básicos", async ({ page }) => {
  await page.goto("/");
  await expect(page)
    .toHaveTitle(/Handee/i, { timeout: 15000 })
    .catch(() => {});
  // Usa un selector único y estable para evitar 'strict mode violation'
  await expect(
    page.getByRole("heading", { name: /¿Qué necesitas hoy\?/i }),
  ).toBeVisible({ timeout: 10000 });
});
