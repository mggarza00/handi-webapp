import process from "node:process";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

async function fetchAllAcceptedApps() {
  const url = `${SUPABASE_URL}/rest/v1/pro_applications?select=user_id,phone,status,updated_at&status=in.(accepted,approved)&order=updated_at.desc`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`fetch pro_applications: ${res.status}`);
  return res.json();
}

async function fetchProfiles(ids) {
  if (!ids.length) return [];
  const url = `${SUPABASE_URL}/rest/v1/profiles?select=id,phone&id=in.(${ids.map((id) => `"${id}"`).join(",")})`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`fetch profiles: ${res.status}`);
  return res.json();
}

async function updateProfilePhone(id, phone) {
  const url = `${SUPABASE_URL}/rest/v1/profiles?id=eq.${id}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ phone }),
  });
  if (!res.ok) throw new Error(`update profile ${id}: ${res.status}`);
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const apps = await fetchAllAcceptedApps();
  const byUser = new Map();
  for (const app of apps) {
    if (!app?.user_id) continue;
    if (!byUser.has(app.user_id)) {
      byUser.set(app.user_id, app);
    }
  }
  const userIds = Array.from(byUser.keys());
  const batches = chunk(userIds, 100);
  let updated = 0;
  for (const batch of batches) {
    const profiles = await fetchProfiles(batch);
    const profileMap = new Map(
      profiles.map((p) => [p.id, (p.phone || "").trim()]),
    );
    for (const userId of batch) {
      const app = byUser.get(userId);
      const phone = typeof app?.phone === "string" ? app.phone.trim() : "";
      if (!phone || phone.length < 8) continue;
      const current = profileMap.get(userId) || "";
      if (current) continue;
      await updateProfilePhone(userId, phone);
      updated += 1;
    }
  }
  console.log(`Backfill complete. Updated: ${updated}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
