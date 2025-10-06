import { test, expect } from "@playwright/test";

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? "cliente.e2e@homaid.mx";
const ENV_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.E2E_APP_URL ||
  process.env.E2E_BASE_URL ||
  undefined;

test.describe("Supabase session flow", () => {
  test("maintains cookie across redirects and navigation", async ({ page, request }) => {
    await page.goto(`/`, { waitUntil: "domcontentloaded" });

    const loginResponse = await request.get(
      `/api/test-auth/login?email=${encodeURIComponent(TEST_EMAIL)}&next=/`,
    );
    if (!loginResponse.ok()) test.skip(true, "Test auth endpoint unavailable (missing Supabase env). Skipping.");
    const payload = await loginResponse.json();
    expect(payload?.token_hash || payload?.action_link).toBeTruthy();

    if (payload?.token_hash) {
      const type = payload?.type || "magiclink";
      await page.goto(`/auth/callback?token_hash=${encodeURIComponent(payload.token_hash)}&type=${encodeURIComponent(type)}&next=/`, { waitUntil: "domcontentloaded" });
    } else {
      await page.goto(payload.action_link, { waitUntil: "domcontentloaded" });
    }

    const finalUrl = new URL(page.url());
    const expectedOrigin = new URL(
      ENV_APP_URL || (test.info().project.use.baseURL as string | undefined) || "http://localhost:3000",
    ).origin;
    expect(finalUrl.origin).toBe(expectedOrigin);

    

    // In dev, Next keeps websocket connections; prefer 'domcontentloaded' here
    await page.goto(`/debug/auth`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("server-user")).toContainText("Server sees user", { timeout: 10000 });
    await expect(page.getByTestId("client-status")).toContainText(
      "Server and client see a session",
      { timeout: 10000 },
    );
    await expect(page.getByTestId("client-session")).toContainText("userId", { timeout: 10000 });

    const routes = ["/requests?mine=1", "/favorites", "/notifications"];
    for (const route of routes) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      
      expect(new URL(page.url()).origin).toBe(expectedOrigin);
    }
  });
});



