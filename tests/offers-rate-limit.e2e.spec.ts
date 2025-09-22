import { expect, test } from "@playwright/test";

test.describe.skip("rate limit en creacion de oferta", () => {
  test("placeholder", async ({ page }) => {
    await page.goto("/mensajes");
    await expect(page).toHaveURL(/mensajes/);
  });
});
