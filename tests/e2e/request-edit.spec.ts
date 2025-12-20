import { test, expect } from "@playwright/test";

// Seed constants per app/api/test-seed
const SEED_REQUEST_ID = "33333333-3333-4333-8333-333333333333";

test.describe("Request detail edit UI", () => {
  test("login as client seed and save edited title", async ({
    page,
    request,
    baseURL,
  }) => {
    // Try seeding data (best effort; ignore if fails in local environments)
    if (baseURL) {
      await request
        .get(`${baseURL}/api/test-seed?action=seed`)
        .catch(() => undefined);
    }

    // Obtain magic action link to sign in as the seeded client
    let actionLink: string | null = null;
    if (baseURL) {
      const r = await request.get(
        `${baseURL}/api/test-auth/login?email=client+seed@handi.dev&next=/`,
      );
      if (r.ok()) {
        const j = await r.json();
        actionLink = j?.action_link ?? null;
      }
    }
    if (!actionLink) test.skip(true, "No action_link for test login");

    // Follow magic link to set Supabase session, then land in app
    await page.goto(actionLink!);
    // Redirect should land back on the app (callback sets session)
    await page.waitForLoadState("networkidle");

    await page.goto(`/requests/${SEED_REQUEST_ID}`);

    // Ensure page rendered
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Enter edit mode
    await page.getByRole("button", { name: /editar/i }).click();

    // Edit and save
    await expect(page.getByLabel("Título")).toBeVisible();
    const newTitle = `Editado E2E ${Date.now()}`;
    await page.getByLabel("Título").fill(newTitle);
    await page.getByRole("button", { name: /guardar/i }).click();

    // Expect SSR refresh with new title visible
    await expect(
      page.getByRole("heading", { level: 1, name: newTitle }),
    ).toBeVisible();
  });
});
