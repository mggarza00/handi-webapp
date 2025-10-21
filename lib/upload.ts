import type { SupabaseClient } from "@supabase/supabase-js";

export async function uploadAvatar(file: File, userId: string, supabase: SupabaseClient) {
  const MAX = 5 * 1024 * 1024;
  if (file.size > MAX) throw new Error(`El archivo ${file.name} excede 5MB`);
  if (!/^image\//i.test(file.type)) throw new Error(`Formato no soportado para ${file.name}`);

  // Best-effort: ensure bucket via admin endpoint
  try {
    await fetch(`/api/storage/ensure?b=avatars`, { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" } });
  } catch { /* ignore */ }

  const ext = (file.name.split(".").pop()?.toLowerCase() ?? "jpg");
  // File path rule: one avatar per user at root of bucket, overwritable
  const path = `${userId}.${ext}`;
  const up = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type, upsert: true });
  if (up.error) throw new Error(up.error.message);

  // Try public URL first; fallback to signed
  const pub = supabase.storage.from("avatars").getPublicUrl(path).data;
  const url = pub?.publicUrl || "";
  return { url, path };
}

export default uploadAvatar;
