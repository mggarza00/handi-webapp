import { test, expect } from "@playwright/test";

// Minimal API checks for /api/requests
test.describe("/api/requests API", () => {
  test("GET defaults to active and supports limit", async ({
    request,
    baseURL,
  }) => {
    const url = `${baseURL || "http://localhost:3000"}/api/requests?limit=2`;
    const res = await request.get(url, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json).toHaveProperty("ok", true);
    const data = (json?.data ?? []) as Array<{ status?: string }>;
    expect(Array.isArray(data)).toBeTruthy();
    expect(data.length).toBeLessThanOrEqual(2);
    for (const r of data) {
      // unauthenticated defaults to active
      expect(r.status).toBe("active");
    }
  });

  test("GET paginates with cursor", async ({ request, baseURL }) => {
    const root = baseURL || "http://localhost:3000";
    const first = await request.get(`${root}/api/requests?limit=1`, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
    expect(first.ok()).toBeTruthy();
    const j1 = await first.json();
    expect(j1).toHaveProperty("ok", true);
    const nextCursor = j1?.nextCursor as string | undefined;
    // If no results, skip the rest
    if (!nextCursor) return;

    const second = await request.get(
      `${root}/api/requests?limit=1&cursor=${encodeURIComponent(nextCursor)}`,
      {
        headers: { "Content-Type": "application/json; charset=utf-8" },
      },
    );
    expect(second.ok()).toBeTruthy();
    const j2 = await second.json();
    expect(j2).toHaveProperty("ok", true);
    // next page may be empty; assert shape only
    expect(j2).toHaveProperty("data");
  });
});
