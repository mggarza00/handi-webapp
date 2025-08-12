// scripts/smoke.mjs
const candidates = [];
if (process.env.BASE_URL) {
  candidates.push(process.env.BASE_URL);
} else {
  candidates.push("http://localhost:3000", "http://localhost:3001");
}

async function tryBase(base) {
  const log = (...a) => console.log(`[${base}]`, ...a);

  async function check(path, expectOk = true) {
    const url = `${base}${path}`;
    try {
      const res = await fetch(url, { method: "GET" });
      const ct = res.headers.get("content-type") || "";
      const body = ct.includes("application/json") ? await res.json() : await res.text();
      const ok = res.ok && (!expectOk || (body && (body.ok === true || body.ok === "true")));
      log(`GET ${path} → ${res.status} ${ok ? "OK" : "WARN"}`);
      if (!ok) log("Body:", body);
      return ok;
    } catch (e) {
      log(`GET ${path} → ERROR`, e.message);
      return false;
    }
  }

  let passed = true;
  console.log("== Smoke Test ==");
  passed &= await check("/api/ping", false);

  try {
    const res = await fetch(`${base}/api/requests?limit=1`, { method: "GET" });
    log(`GET /api/requests?limit=1 → ${res.status} ${res.ok ? "OK" : "WARN"}`);
    if (!res.ok) passed = false;
  } catch (e) {
    log("GET /api/requests?limit=1 → ERROR", e.message);
    passed = false;
  }

  return !!passed;
}

(async () => {
  for (const base of candidates) {
    const ok = await tryBase(base);
    if (ok) {
      console.log(`\nRESULT: ALL GOOD on ${base} ✅`);
      process.exit(0);
    }
  }
  console.log(`\nRESULT: CHECK FAILURES ⚠️`);
  process.exit(1);
})();
