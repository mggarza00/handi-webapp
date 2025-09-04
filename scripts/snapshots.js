#!/usr/bin/env node
/*
  Responsive snapshot script using Playwright (chromium)
  - Uses BASE_URL env or falls back to http://localhost:3000
  - ROUTES can be a comma-separated list; otherwise uses defaults
  - Viewports: 390, 768, 1280 widths
  Outputs: artifacts/screenshots/{route}__{width}.png
*/
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.PREVIEW_URL || process.env.BASE_URL || 'http://localhost:3000';
const ROUTES = (process.env.ROUTES && process.env.ROUTES.split(',').map(s => s.trim()).filter(Boolean)) || [
  '/',
  '/design-check'
];
const VIEWPORTS = [390, 768, 1280];
const OUT_DIR = path.join(process.cwd(), 'snapshots');

async function ensureDir(p) {
  await fs.promises.mkdir(p, { recursive: true });
}

function safeName(route) {
  return route.replace(/\//g, '_').replace(/^_/, '') || 'home';
}

async function run() {
  await ensureDir(OUT_DIR);
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ deviceScaleFactor: 1 });
    const page = await context.newPage();
    for (const route of ROUTES) {
      const name = safeName(route);
      const url = new URL(route, BASE_URL).toString();
      for (const width of VIEWPORTS) {
        await page.setViewportSize({ width, height: 900 });
        try {
          await page.goto(url, { waitUntil: 'networkidle' });
          // small settle time for client hydration/animations
          await page.waitForTimeout(300);
          const file = path.join(OUT_DIR, `${name}__${width}.png`);
          await page.screenshot({ path: file, fullPage: true });
          console.log(`Saved: ${file}`);
        } catch (err) {
          console.error(`Snapshot failed for ${url} @${width}px`, err.message);
        }
      }
    }
  } finally {
    await browser.close();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
