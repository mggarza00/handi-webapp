// Script: migrate-professionals-gallery.mjs
// Copies each user's folder from 'profiles-gallery' to 'professionals-gallery'.
// Usage: node scripts/migrate-professionals-gallery.mjs
// Requires env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !service) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, service, { auth: { persistSession: false } });

async function listAll(prefix) {
  let page = 0;
  const size = 100;
  const out = [];
  // Supabase storage list does not support pagination markers; emulate limited pages
  // by trusting that 100 is enough per user folder (typical portfolios).
  const { data, error } = await admin.storage.from("profiles-gallery").list(prefix, {
    limit: size,
    sortBy: { column: "updated_at", order: "desc" },
  });
  if (error) throw error;
  return data || [];
}

async function migrateUser(userId) {
  const dir = `${userId}/`;
  const items = await listAll(dir);
  for (const obj of items) {
    if (!obj?.name) continue;
    const path = dir + obj.name;
    // Download from old bucket
    const dl = await admin.storage.from("profiles-gallery").download(path);
    if (dl.error) {
      console.warn("skip", path, dl.error.message);
      continue;
    }
    const file = dl.data;
    const ct = obj.metadata?.mimetype || "application/octet-stream";
    // Upload to new bucket
    const up = await admin.storage
      .from("professionals-gallery")
      .upload(path, file, { contentType: ct, upsert: true });
    if (up.error) {
      console.warn("upload failed", path, up.error.message);
    } else {
      console.log("copied", path);
    }
  }
}

async function main() {
  // users to migrate: from professionals table (id-only)
  const { data, error } = await admin.from("professionals").select("id").limit(10000);
  if (error) throw error;
  const ids = (data || []).map((r) => r.id).filter(Boolean);
  for (const id of ids) {
    try {
      await migrateUser(id);
    } catch (e) {
      console.error("user failed:", id, e?.message || e);
    }
  }
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

