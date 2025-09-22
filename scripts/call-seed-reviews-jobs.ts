/*
  Seed reviews + jobs data via API (dev only)
  Usage:
    BASE_URL=http://localhost:3000 npm run dev:seed:reviews
*/

async function main() {
  const url = 'http://localhost:3000/api/dev/seed-reviews-jobs';
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  const text = await res.text();
  if (!res.ok) {
    console.error('Seed failed', res.status, text);
    process.exit(1);
  }
  console.log('Seed OK', text);
}

main().catch((e) => {
  console.error('Seed error', e);
  process.exit(1);
});
