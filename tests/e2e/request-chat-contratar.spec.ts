import { test, expect, APIRequestContext, Page } from "@playwright/test";

const SEED_REQUEST_ID = "33333333-3333-4333-8333-333333333333";
const CLIENT_EMAIL = "client+seed@handi.dev";

async function loginWithMagicLink(
  page: Page,
  request: APIRequestContext,
  baseURL: string | undefined,
  email: string,
) {
  const prefix = baseURL ?? "";
  const res = await request.get(
    `${prefix}/api/test-auth/login?email=${encodeURIComponent(email)}&next=/`,
    { headers: { "Content-Type": "application/json; charset=utf-8" } },
  );
  expect(res.ok(), `login link for ${email}`).toBeTruthy();
  const payload = await res.json();
  const tokenHash = payload?.token_hash as string | undefined;
  const actionLink = payload?.action_link as string | undefined;
  if (tokenHash) {
    const type = (payload?.type as string | undefined) ?? "magiclink";
    const callbackUrl = `/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(type)}&next=${encodeURIComponent("/")}`;
    await page.goto(callbackUrl, { waitUntil: "networkidle" });
  } else if (actionLink) {
    await page.goto(actionLink, { waitUntil: "networkidle" });
  } else {
    throw new Error(`No magic link for ${email}`);
  }
  await page.waitForLoadState("networkidle");
}

test.describe("Request chat contratar CTA", () => {
  let SEED_OK = true;
  test.beforeAll(async ({ request, baseURL }) => {
    const prefix = baseURL ?? "";
    const reset = await request.get(
      `${prefix}/api/test-seed?action=reset`,
      { headers: { "Content-Type": "application/json; charset=utf-8" } },
    );
    if (!reset.ok()) {
      SEED_OK = false;
      return;
    }
    const seed = await request.get(
      `${prefix}/api/test-seed?action=seed`,
      { headers: { "Content-Type": "application/json; charset=utf-8" } },
    );
    if (!seed.ok()) {
      // eslint-disable-next-line no-console
      console.error("seed.error", seed.status(), await seed.text());
    }
    SEED_OK = seed.ok();
  });

  test("client can send a contract offer from chat", async ({ page, request, baseURL }) => {
    if (!SEED_OK) test.skip(true, "Seed unavailable (missing Supabase env). Skipping.");
    await loginWithMagicLink(page, request, baseURL, CLIENT_EMAIL);

    await page.goto(`/requests/${SEED_REQUEST_ID}?testChat=1`, { waitUntil: "networkidle" });

    const peerSelect = page.locator("select");
    await expect(peerSelect).toBeVisible({ timeout: 15_000 });
    const chatTestCard = page.locator('[data-testid="chat-test-card"]');
    await expect(chatTestCard).toBeVisible();
    await peerSelect.selectOption({ label: "Pro Seed" });

    const contractCta = chatTestCard.locator("button", { hasText: "Contratar" }).first();
    await expect(contractCta).toBeEnabled({ timeout: 15_000 });
    await contractCta.click();
    const offerDialog = page
      .locator('[data-slot="dialog-content"]').filter({ hasText: "Crear oferta" });
    await expect(offerDialog).toBeVisible({ timeout: 10_000 });
    await expect(
      offerDialog.getByText("Define el monto y los detalles antes de enviar la oferta."),
    ).toBeVisible();
  });
});
