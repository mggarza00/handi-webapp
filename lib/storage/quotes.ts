// lib/storage/quotes.ts
import { createServerClient } from "@/lib/supabase";

const BUCKET = "message-attachments";

export async function getSignedUrl(path: string, expireSeconds = 600): Promise<string | null> {
  const admin = createServerClient();
  const key = path.replace(/^\/+/, "");
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(key, expireSeconds);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function uploadQuoteImage(key: string, buffer: Buffer, contentType = "image/png"): Promise<{ ok: boolean; error?: string | null }> {
  const admin = createServerClient();
  const normalized = key.replace(/^\/+/, "");
  const { error } = await admin.storage.from(BUCKET).upload(normalized, buffer, {
    contentType,
    upsert: true,
  });
  return { ok: !error, error: error?.message };
}
