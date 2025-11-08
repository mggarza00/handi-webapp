import { chromium } from "@playwright/test";

async function main() {
  const baseURL = process.env.E2E_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await page.addInitScript(() => {
      try { localStorage.removeItem("one_tap_dismissed_until"); } catch {}
    });
    await page.goto(baseURL, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => (
      !!document.getElementById("google-identity-script") || !!(window as any).google?.accounts?.id
    ), undefined, { timeout: 20000 });
    const hasGoogle = await page.evaluate(() => !!(window as any).google?.accounts?.id);
    if (!hasGoogle) throw new Error("window.google.accounts.id not present");
    console.log("One Tap: google.accounts.id is available");
    process.exit(0);
  } catch (e) {
    console.error("One Tap check failed:", e instanceof Error ? e.message : e);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();

