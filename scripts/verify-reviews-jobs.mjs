// Quick verification for reviews/jobs endpoints and cursors
/* Usage:
   BASE_URL=http://localhost:3000 PROF_ID=<uuid> node scripts/verify-reviews-jobs.mjs
*/
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const PROF = process.env.PROF_ID || process.argv[2];

if (!PROF) {
  console.error('Missing PROF_ID (env or argv)');
  process.exit(1);
}

async function jget(path) {
  const res = await fetch(BASE_URL + path, { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  let json = null;
  try { json = await res.json(); } catch {}
  if (!res.ok || !json || json.ok === false) {
    throw new Error(`GET ${path} failed: ${res.status} ${(json && json.error) || ''}`);
  }
  return json;
}

(async () => {
  // Aggregate summary
  const agg = await jget(`/api/reviews?professional_id=${encodeURIComponent(PROF)}&aggregate=1`);
  const sum = agg.summary || { count: 0, average: null };
  console.log('Summary:', sum);

  // Reviews pagination
  const pg1 = await jget(`/api/professionals/${PROF}/reviews?limit=12`);
  const ids = new Set(pg1.data.map((r) => r.id));
  console.log('Reviews page1:', pg1.data.length, 'nextCursor:', pg1.nextCursor);
  if (pg1.nextCursor) {
    const pg2 = await jget(`/api/professionals/${PROF}/reviews?limit=12&cursor=${encodeURIComponent(pg1.nextCursor)}`);
    console.log('Reviews page2:', pg2.data.length, 'nextCursor:', pg2.nextCursor);
    for (const r of pg2.data) {
      if (ids.has(r.id)) throw new Error('Duplicate review id across pages: ' + r.id);
      ids.add(r.id);
    }
  }

  // Jobs pagination
  const j1 = await jget(`/api/professionals/${PROF}/jobs?limit=10`);
  const reqs = new Set(j1.data.map((r) => r.request_id));
  console.log('Jobs page1:', j1.data.length, 'nextCursor:', j1.nextCursor);
  if (j1.nextCursor) {
    const j2 = await jget(`/api/professionals/${PROF}/jobs?limit=10&cursor=${encodeURIComponent(j1.nextCursor)}`);
    console.log('Jobs page2:', j2.data.length, 'nextCursor:', j2.nextCursor);
    for (const it of j2.data) {
      if (reqs.has(it.request_id)) throw new Error('Duplicate request across pages: ' + it.request_id);
      reqs.add(it.request_id);
    }
  }

  console.log('OK: endpoints healthy');
})().catch((e) => {
  console.error('Verification failed:', e.message);
  if (process.env.NODE_ENV !== 'production') console.error(e);
  process.exit(2);
});

