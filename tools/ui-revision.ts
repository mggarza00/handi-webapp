#!/usr/bin/env tsx
/**
 * UI revision orchestrator (offline stub)
 * - Lee targets desde scripts/ui-revision.targets.json
 * - Genera capturas PNG + HTML/DOM por target/viewport en artifacts/ui-revision/<target>/
 * - Punto de extensión: enviar a modelo (no implementado en este entorno)
 * - Itera hasta maxIterations (por defecto 1 aquí; configurable via --iterations)
 */
import { chromium, type Browser, type Page } from "@playwright/test";
import fs from "fs";
import path from "path";

type TargetConfig = {
  id: string;
  path?: string;
  url?: string;
  role?: string;
  waitAfterMs?: number;
  viewports?: number[];
  notes?: string;
  successCriteria?: string[];
};

type FullConfig = {
  viewports?: number[];
  screens?: TargetConfig[];
};

const ROOT = process.cwd();
const TARGETS_PATH = path.join(ROOT, "scripts", "ui-revision.targets.json");
const ARTIFACT_ROOT = path.join(ROOT, "artifacts", "ui-revision");

type CliArgs = {
  target?: string;
  iterations?: number;
  headless?: boolean;
};

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = {};
  argv.forEach((arg) => {
    if (arg.startsWith("--target=")) out.target = arg.split("=", 2)[1];
    if (arg.startsWith("--iterations=")) {
      const n = Number.parseInt(arg.split("=", 2)[1], 10);
      if (Number.isFinite(n) && n > 0) out.iterations = n;
    }
    if (arg === "--headed" || arg === "--headless=false") out.headless = false;
  });
  return out;
}

function readConfig(): FullConfig {
  if (!fs.existsSync(TARGETS_PATH)) {
    throw new Error(`No se encontró ${TARGETS_PATH}`);
  }
  const raw = fs.readFileSync(TARGETS_PATH, "utf8");
  return JSON.parse(raw) as FullConfig;
}

async function ensureDir(p: string) {
  await fs.promises.mkdir(p, { recursive: true });
}

function cookieTemplate(baseUrl: string) {
  const parsed = new URL(baseUrl);
  return {
    domain: parsed.hostname,
    path: "/",
    secure: parsed.protocol === "https:",
    httpOnly: false,
    sameSite: "Lax" as const,
  };
}

async function primeRoleSession(page: Page, baseUrl: string, role?: string | null) {
  if (!role || role === "guest") return;
  const tmpl = cookieTemplate(baseUrl);
  const expires = Math.floor(Date.now() / 1000) + 60 * 60;
  await page.context().addCookies([
    { ...tmpl, name: "handi_role", value: role, expires },
    {
      ...tmpl,
      name: "e2e_session",
      value: `${encodeURIComponent(`ui-${role}@revision.local`)}:${encodeURIComponent(role)}`,
      httpOnly: true,
      expires,
    },
  ]);
  const loginUrl = new URL(`/api/test-auth/login?role=${encodeURIComponent(role)}&next=/`, baseUrl).toString();
  try {
    await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 12_000 });
  } catch (err) {
    console.warn(`[ui-revision] auth bootstrap failed for role=${role}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function captureTarget(
  browser: Browser,
  target: TargetConfig,
  baseUrl: string,
  viewports: number[],
  iter: number,
) {
  const context = await browser.newContext({ deviceScaleFactor: 1 });
  const page = await context.newPage();
  await primeRoleSession(page, baseUrl, target.role || "guest");
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const url = target.url || `${base}${target.path || "/"}`;

  const consoleLogs: Array<{ type: string; text: string }> = [];
  page.on("console", (msg) => {
    if (msg.type() === "warning" || msg.type() === "error") {
      consoleLogs.push({ type: msg.type(), text: msg.text() });
    }
  });
  page.on("pageerror", (err) => {
    consoleLogs.push({ type: "pageerror", text: err.message });
  });

  const resultDir = path.join(ARTIFACT_ROOT, target.id, `iter-${iter}`);
  await ensureDir(resultDir);
  const meta: Record<string, unknown> = {
    id: target.id,
    url,
    role: target.role || "guest",
    notes: target.notes || null,
    successCriteria: target.successCriteria || null,
    viewports,
    assets: [] as Array<{ viewport: number; screenshot: string; html: string; ok: boolean; error?: string }>,
    console: consoleLogs,
  };

  for (const width of viewports) {
    const height = width <= 430 ? 844 : width <= 900 ? 1024 : 900;
    await page.setViewportSize({ width, height });
    const assetBase = `${target.id}__${width}`;
    const pngPath = path.join(resultDir, `${assetBase}.png`);
    const htmlPath = path.join(resultDir, `${assetBase}.html`);
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 40_000 });
      const waitMs = target.waitAfterMs ?? 400;
      if (waitMs > 0) await page.waitForTimeout(waitMs);
      await page.screenshot({ path: pngPath, fullPage: true });
      const html = await page.content();
      await fs.promises.writeFile(htmlPath, html, "utf8");
      (meta.assets as any).push({ viewport: width, screenshot: pngPath, html: htmlPath, ok: true });
      console.log(`[ui-revision] Saved ${pngPath}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[ui-revision] Failed ${target.id} @${width}px: ${msg}`);
      (meta.assets as any).push({ viewport: width, screenshot: pngPath, html: htmlPath, ok: false, error: msg });
    }
  }

  const metaPath = path.join(resultDir, "meta.json");
  await fs.promises.writeFile(metaPath, JSON.stringify(meta, null, 2), "utf8");
  await context.close();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = readConfig();
  const baseUrl = process.env.PREVIEW_URL || process.env.BASE_URL || "http://localhost:3000";
  const viewports =
    (config.viewports || [])
      .map((v) => Number.parseInt(String(v), 10))
      .filter((n) => Number.isFinite(n) && n > 0) || [];
  const vp = (process.env.VIEWPORTS || "")
    .split(",")
    .map((v) => Number.parseInt(v.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  const finalViewports = vp.length ? vp : viewports.length ? viewports : [390, 768, 1280];

  const targets = (config.screens || []).filter((t) => !args.target || t.id === args.target);
  if (!targets.length) {
    console.error("[ui-revision] No se encontraron targets (revisa scripts/ui-revision.targets.json o usa --target=ID)");
    process.exit(1);
  }

  const iterations = args.iterations && args.iterations > 0 ? args.iterations : 1;
  const browser = await chromium.launch({ headless: args.headless !== false });

  for (let iter = 1; iter <= iterations; iter++) {
    console.log(`[ui-revision] Iteración ${iter}/${iterations} — ${targets.length} targets`);
    for (const target of targets) {
      await captureTarget(browser, target, baseUrl, target.viewports?.length ? target.viewports : finalViewports, iter);
      // Punto de extensión: aquí se llamaría a OpenAI y se aplicarían patches.
    }
    // Punto de extensión: decidir si continuar según respuesta del modelo. Sin modelo, solo 1 iter o el valor pedido.
  }

  await browser.close();
  console.log("[ui-revision] Listo. Artefactos en artifacts/ui-revision/");
}

main().catch((err) => {
  console.error("[ui-revision] Error:", err);
  process.exit(1);
});
