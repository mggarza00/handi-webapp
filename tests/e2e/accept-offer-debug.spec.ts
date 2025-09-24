import { test, expect } from "@playwright/test";

// Provide these via env when running locally:
// E2E_CONV_ID=... E2E_OFFER_ID=... E2E_PRO_ID=...

const CONV_ID = process.env.E2E_CONV_ID || "";
const OFFER_ID = process.env.E2E_OFFER_ID || "";
const PRO_ID = process.env.E2E_PRO_ID || "";

test.describe("Debug accept offer API", () => {
  test("POST /api/offers/:id/accept returns 200", async ({ request, baseURL }) => {
    test.skip(!CONV_ID || !OFFER_ID || !PRO_ID, "Set E2E_CONV_ID, E2E_OFFER_ID, E2E_PRO_ID first");
    const url = `${baseURL ?? ""}/api/offers/${OFFER_ID}/accept`;
    const res = await request.post(url, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        // Bypass cookie auth in dev by providing acting user id
        "x-user-id": PRO_ID,
      },
      data: { conversationId: CONV_ID },
    });
    const body = await res.text();
    // eslint-disable-next-line no-console
    console.log("accept.status", res.status(), body);
    expect(res.ok(), body).toBeTruthy();
  });
});

