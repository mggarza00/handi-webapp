import { test, expect } from "@playwright/test";

test.describe("/api/classify-request", () => {
  test("classifies a simple plumbing request (fallback heuristics if no OpenAI)", async ({ request }) => {
    const res = await request.post("/api/classify-request", {
      data: { title: "Tengo una fuga de agua en el baño", description: "Sale agua de la tubería bajo el lavabo" },
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
    expect(res.status()).toBeLessThan(500);
    const j = await res.json();
    expect(j).toHaveProperty("ok");
    expect(j.ok).toBe(true);
    // best is optional but likely present via heuristics fallback
    if (j.best) {
      expect(typeof j.best.category).toBe("string");
      expect(typeof j.best.subcategory).toBe("string");
      expect(typeof j.best.confidence).toBe("number");
      // ids may be null in fallback taxonomy; shape must be present
      expect(j).toHaveProperty("alternatives");
      expect(Array.isArray(j.alternatives)).toBe(true);
    }
  });
});

