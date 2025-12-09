#!/usr/bin/env node
/*
  UI snapshot runner using Playwright (chromium)
  - BASE_URL/PREVIEW_URL override the target host
  - ROUTES comma list overrides default key screens (home, requests, mensajes, pro, admin)
  - VIEWPORTS comma list overrides widths (default 390,768,1280)
  - SNAPSHOT_STRICT=true makes the script exit 1 if any capture fails
  Outputs:
    - snapshots/{name}__{width}.png
    - snapshots/ui-review.json (console + HTTP errors per screen)
*/
const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const BASE_URL =
  process.env.PREVIEW_URL || process.env.BASE_URL || "http://localhost:3000";
const OUT_DIR = path.join(process.cwd(), "snapshots");
const REPORT_PATH = path.join(OUT_DIR, "ui-review.json");
const STRICT = process.env.SNAPSHOT_STRICT === "true";
const CONFIG_PATH = path.join(process.cwd(), "scripts", "ui-revision.targets.json");

const DEFAULT_SCREENS = [
  { path: "/", name: "home-guest", role: "guest" },
  { path: "/design-check", name: "design-check", role: "guest" },
  { path: "/requests", name: "requests-client", role: "client" },
  { path: "/mensajes", name: "messages-client", role: "client" },
  { path: "/pro", name: "pro-dashboard", role: "professional" },
  { path: "/admin", name: "admin-dashboard", role: "admin" },
];

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return {};
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw);
    const viewports = Array.isArray(parsed?.viewports)
      ? parsed.viewports
          .map((v) => Number.parseInt(String(v), 10))
          .filter((n) => Number.isFinite(n) && n > 0)
      : null;
    const screens = Array.isArray(parsed?.screens)
      ? parsed.screens
          .map((s) => ({
            path: typeof s.path === "string" ? s.path : null,
            name: typeof s.name === "string" ? s.name : typeof s.id === "string" ? s.id : null,
            role: typeof s.role === "string" ? s.role : null,
            waitAfterMs:
              typeof s.waitAfterMs === "number" && s.waitAfterMs > 0
                ? s.waitAfterMs
                : null,
          }))
          .filter((s) => !!s.path)
      : null;
    return { viewports, screens };
  } catch (err) {
    console.warn(`[snapshots] Failed to read ${CONFIG_PATH}:`, err?.message || err);
    return {};
  }
}

const { viewports: configViewports, screens: configScreens } = loadConfig();
const VIEWPORTS =
  parseViewports(process.env.VIEWPORTS) || configViewports || [390, 768, 1280];

function parseRoutes(raw) {
  if (!raw) return null;
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : null;
}

function parseViewports(raw) {
  if (!raw) return null;
  const parts = raw
    .split(",")
    .map((v) => Number.parseInt(v.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  return parts.length ? parts : null;
}

function safeName(label) {
  return label.replace(/[^a-z0-9._-]+/gi, "_").replace(/^_+/, "") || "page";
}

function heightForWidth(width) {
  if (width <= 430) return 844;
  if (width <= 900) return 1024;
  return 900;
}

async function ensureDir(p) {
  await fs.promises.mkdir(p, { recursive: true });
}

function cookieTemplate() {
  const parsed = new URL(BASE_URL);
  return {
    domain: parsed.hostname,
    path: "/",
    secure: parsed.protocol === "https:",
    httpOnly: false,
    sameSite: "Lax",
  };
}

async function primeRoleSession(context, role) {
  if (!role || role === "guest") return;
  const baseCookie = cookieTemplate();
  const expires = Math.floor(Date.now() / 1000) + 60 * 60;
  const cookies = [
    { ...baseCookie, name: "handi_role", value: role, expires },
    {
      ...baseCookie,
      name: "e2e_session",
      value: `${encodeURIComponent(`ui-${role}@snapshots.local`)}:${encodeURIComponent(role)}`,
      httpOnly: true,
      expires,
    },
  ];
  await context.addCookies(cookies).catch(() => undefined);

  const helper = await context.newPage();
  const loginUrl = new URL(
    `/api/test-auth/login?role=${encodeURIComponent(role)}&next=/`,
    BASE_URL,
  ).toString();
  const roleUrl = new URL(`/api/test-auth/${encodeURIComponent(role)}`, BASE_URL).toString();
  try {
    await helper.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 12_000 });
  } catch (err) {
    console.warn(`[snapshots] Auth bootstrap failed for role=${role}: ${err?.message || err}`);
  }
  try {
    await helper.goto(roleUrl, { waitUntil: "domcontentloaded", timeout: 8_000 });
  } catch {
    // role cookie endpoint is optional
  }
  await helper.close();
}

async function captureScreen(browser, screen) {
  const context = await browser.newContext({ deviceScaleFactor: 1 });
  await primeRoleSession(context, screen.role || "guest");
  const page = await context.newPage();

  const consoleErrors = [];
  const httpErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      consoleErrors.push({ type: msg.type(), text: msg.text() });
    }
  });
  page.on("pageerror", (err) => {
    consoleErrors.push({ type: "pageerror", text: err.message });
  });
  page.on("response", (res) => {
    const status = res.status();
    if (status >= 400 && httpErrors.length < 30) {
      httpErrors.push({ status, url: res.url() });
    }
  });

  const results = [];
  for (const width of VIEWPORTS) {
    const height = heightForWidth(width);
    await page.setViewportSize({ width, height });
    const targetUrl = new URL(screen.path, BASE_URL).toString();
    try {
      await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 40_000 });
      const settleMs = screen.waitAfterMs ?? 400;
      if (settleMs > 0) {
        await page.waitForTimeout(settleMs);
      }
      const file = path.join(
        OUT_DIR,
        `${safeName(screen.name || screen.path)}__${width}.png`,
      );
      await page.screenshot({ path: file, fullPage: true });
      console.log(`[snapshots] Saved ${file}`);
      results.push({ width, height, file, ok: true });
    } catch (err) {
      const msg = err?.message || String(err);
      console.error(`[snapshots] Failed ${targetUrl} @${width}px: ${msg}`);
      results.push({ width, height, error: msg });
    }
  }

  await context.close();
  return {
    name: screen.name || safeName(screen.path),
    path: screen.path,
    role: screen.role || "guest",
    results,
    consoleErrors,
    httpErrors,
  };
}

async function run() {
  await ensureDir(OUT_DIR);
  const customRoutes = parseRoutes(process.env.ROUTES);
  const screens = customRoutes
    ? customRoutes.map((r) => ({ path: r, name: safeName(r), role: "guest" }))
    : configScreens && configScreens.length > 0
      ? configScreens.map((s) => ({
          path: s.path,
          name: s.name || safeName(s.path),
          role: s.role || "guest",
          waitAfterMs: s.waitAfterMs || undefined,
        }))
      : DEFAULT_SCREENS;

  const browser = await chromium.launch({ headless: process.env.HEADLESS !== "false" });
  const report = {
    baseUrl: BASE_URL,
    generatedAt: new Date().toISOString(),
    viewports: VIEWPORTS,
    screens: [],
  };
  let hadFailures = false;

  try {
    for (const screen of screens) {
      const entry = await captureScreen(browser, screen);
      if (entry.results.some((r) => r.error)) hadFailures = true;
      report.screens.push(entry);
    }
  } finally {
    await browser.close();
  }

  await fs.promises.writeFile(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`[snapshots] Report written to ${REPORT_PATH}`);

  if (STRICT && hadFailures) {
    console.error("[snapshots] Failing due to SNAPSHOT_STRICT and capture errors");
    process.exit(1);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
