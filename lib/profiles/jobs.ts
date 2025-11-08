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
 * Returns a list of completed jobs (distinct requests) for a professional,
 * each with up to 6 photo URLs taken from `service_photos`.
 */
export async function getProJobsWithPhotos(
  supa: SupabaseClient<Database>,
  professionalId: string,
  limit = 6,
): Promise<JobItem[]> {
  // 1) Completed agreements for this pro (ordered by completion date desc)
  const ag = await supa
    .from("agreements")
    .select("request_id, status, completed_at")
    .eq("professional_id", professionalId)
    .in("status", ["completed" as any, "finalizada" as any])
    .order("completed_at", { ascending: false, nullsFirst: false });
  const agreements = ((ag.data as Array<{ request_id: string; completed_at: string | null }> | null) ?? []).filter(
    (a) => !!a.request_id,
  );
  if (!agreements.length) return [];

  // 2) Unique request ids by most recent completion
  const byRequest = new Map<string, { completed_at: string | null }>();
  for (const a of agreements) {
    const prev = byRequest.get(a.request_id);
    if (!prev || (a.completed_at && (!prev.completed_at || a.completed_at > prev.completed_at))) {
      byRequest.set(a.request_id, { completed_at: a.completed_at });
    }
  }
  // Keep order by completed_at desc
  const sortedReqIds = Array.from(byRequest.entries())
    .sort((a, b) => {
      const av = a[1].completed_at || "";
      const bv = b[1].completed_at || "";
      return av < bv ? 1 : av > bv ? -1 : 0;
    })
    .map(([id]) => id);

  // 3) Fetch photos for these requests and this pro
  const wanted = sortedReqIds.slice(0, Math.max(limit * 3, limit));
  const ph = await supa
    .from("service_photos")
    .select("id, request_id, image_url, url, uploaded_at")
    .eq("professional_id", professionalId)
    .in("request_id", wanted);
  const photos = (ph.data ?? []) as Array<Database["public"]["Tables"]["service_photos"]["Row"] & { url?: string | null; uploaded_at?: string | null }>;
  const photosByReq = new Map<string, string[]>();
  for (const p of photos) {
    const u = (p as any).url || p.image_url;
    if (!u) continue;
    const list = photosByReq.get(p.request_id) || [];
    if (list.length < 6) list.push(u);
    photosByReq.set(p.request_id, list);
  }

  // 4) Filter to requests that actually have photos
  const withPhotos = sortedReqIds.filter((rid) => (photosByReq.get(rid)?.length ?? 0) > 0);
  if (!withPhotos.length) return [];

  // 5) Fetch titles
  const rq = await supa.from("requests").select("id, title").in("id", withPhotos.slice(0, limit));
  const titles = new Map<string, string>();
  for (const r of ((rq.data as Array<{ id: string; title?: string | null }> | null) ?? [])) {
    titles.set(r.id, (r.title as string | undefined) || "");
  }

  // 6) Compose result limited to `limit` distinct requests
  const items: JobItem[] = [];
  for (const rid of withPhotos) {
    if (items.length >= limit) break;
    items.push({
      request_id: rid,
      request_title: titles.get(rid) || "",
      photos: photosByReq.get(rid) || [],
      completed_at: byRequest.get(rid)?.completed_at ?? null,
    });
  }
  return items;
}
