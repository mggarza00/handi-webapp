/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";

export type JobItem = {
  request_id: string;
  request_title: string;
  photos: string[];
  completed_at?: string | null;
};

/**
 * Returns a list of jobs (distinct requests) for a professional,
 * each with up to 6 photo URLs taken from `service_photos`.
 */
export async function getProJobsWithPhotos(
  supa: SupabaseClient<Database>,
  professionalId: string,
  limit = 6,
): Promise<JobItem[]> {
  const ph = await supa
    .from("service_photos")
    .select("id, request_id, image_url, url, uploaded_at, created_at")
    .eq("professional_id", professionalId)
    .order("uploaded_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(Math.max(limit * 20, limit));
  const photos =
    (ph.data as Array<
      Database["public"]["Tables"]["service_photos"]["Row"] & {
        url?: string | null;
        uploaded_at?: string | null;
        created_at?: string | null;
      }
    > | null) ?? [];
  if (!photos.length) return [];

  const photosByReq = new Map<string, { photos: string[]; latest: string | null }>();
  for (const p of photos) {
    const rid = p.request_id;
    if (!rid) continue;
    const u = (p as any).url || p.image_url;
    if (!u) continue;
    const entry = photosByReq.get(rid) || { photos: [], latest: null };
    if (entry.photos.length < 6) entry.photos.push(u);
    const ts = (p as any).uploaded_at || p.created_at || null;
    if (ts && (!entry.latest || ts > entry.latest)) entry.latest = ts;
    photosByReq.set(rid, entry);
  }

  const sortedReqIds = Array.from(photosByReq.entries())
    .sort((a, b) => {
      const av = a[1].latest || "";
      const bv = b[1].latest || "";
      return av < bv ? 1 : av > bv ? -1 : 0;
    })
    .map(([id]) => id)
    .slice(0, limit);
  if (!sortedReqIds.length) return [];

  const rq = await supa.from("requests").select("id, title").in("id", sortedReqIds);
  const titles = new Map<string, string>();
  for (const r of ((rq.data as Array<{ id: string; title?: string | null }> | null) ?? [])) {
    titles.set(r.id, (r.title as string | undefined) || "");
  }

  return sortedReqIds.map((rid) => ({
    request_id: rid,
    request_title: titles.get(rid) || "",
    photos: photosByReq.get(rid)?.photos ?? [],
    completed_at: photosByReq.get(rid)?.latest ?? null,
  }));
}
