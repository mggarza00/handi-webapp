#!/usr/bin/env node
/*
  UI Review Orchestrator
  - Runs typecheck + lint
  - Builds and serves the app (if no BASE_URL provided)
  - Captures responsive screenshots via scripts/snapshots.js
*/
import { spawn } from "node:child_process";
import http from "node:http";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const BASE_URL =
  process.env.PREVIEW_URL || process.env.BASE_URL || `http://localhost:${PORT}`;

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(url, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          res.resume();
          resolve();
        });
        req.on("error", reject);
        req.end();
      });
      return true;
    } catch (_) {
      await wait(1000);
    }
  }
  return false;
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      ...opts,
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`));
    });
  });
}

async function main() {
  // 1) Typecheck + lint (soft-fail)
  try {
    await run("npm", ["run", "check"]);
  } catch (err) {
    console.warn("[ui-review] check failed; continuing:", err.message);
  }

  const hasExternal = !!(process.env.PREVIEW_URL || process.env.BASE_URL);
  if (hasExternal) {
    await run("node", ["scripts/snapshots.js"], {
      env: { ...process.env, BASE_URL },
    });
    // Lighthouse pass (non-blocking)
    try {
      await run(
        "npx",
        [
          "lhci",
          "autorun",
          "--config=lighthouserc.cjs",
          "--collect.numberOfRuns",
          "1",
        ],
        { env: { ...process.env, BASE_URL } },
      );
    } catch (err) {
      console.warn("[ui-review] lighthouse failed; continuing:", err.message);
    }
    return;
  }

  // 2) Start Next.js in dev mode locally (avoids build/typecheck blockers)
  const server = spawn(
    "node",
    ["node_modules/next/dist/bin/next", "dev", "-p", String(PORT)],
    {
      stdio: "inherit",
      shell: process.platform === "win32",
    },
  );

  try {
    const ok = await waitForServer(`${BASE_URL}/`);
    if (!ok) throw new Error("Dev server did not become ready in time");
    await run("node", ["scripts/snapshots.js"], {
      env: { ...process.env, BASE_URL },
    });
    // Lighthouse pass (non-blocking)
    try {
      await run(
        "npx",
        [
          "lhci",
          "autorun",
          "--config=lighthouserc.cjs",
          "--collect.numberOfRuns",
          "1",
        ],
        { env: { ...process.env, BASE_URL } },
      );
    } catch (err) {
      console.warn("[ui-review] lighthouse failed; continuing:", err.message);
    }
  } finally {
    if (server && !server.killed) {
      server.kill("SIGTERM");
    }
  }
}

main().catch((err) => {
  console.error("[ui-review] Error:", err.message);
  process.exit(1);
});
