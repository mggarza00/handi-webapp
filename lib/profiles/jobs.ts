/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";

export type JobItem = {
  request_id: string;
  request_title: string;
  photos: string[];
  completed_at?: string | null;
};

const COMPLETED_REQUEST_STATUSES = ["finalizada", "completed", "finished"];

/**
 * Returns completed jobs for a professional, including entries without photos.
 * Photos are attached when available from `service_photos`.
 */
export async function getProJobsWithPhotos(
  supa: SupabaseClient<Database>,
  professionalId: string,
  limit = 6,
): Promise<JobItem[]> {
  const candidateIds = Array.from(new Set([professionalId]));
  try {
    const identity = await (supa as any)
      .from("professionals")
      .select("id, user_id")
      .or(`id.eq.${professionalId},user_id.eq.${professionalId}`)
      .limit(2);
    const rows =
      (identity.data as Array<{
        id?: string | null;
        user_id?: string | null;
      }> | null) ?? [];
    for (const row of rows) {
      if (row?.id) candidateIds.push(row.id);
      if (row?.user_id) candidateIds.push(row.user_id);
    }
  } catch {
    /* ignore */
  }
  const uniqueCandidateIds = Array.from(new Set(candidateIds));

  const ph = await supa
    .from("service_photos")
    .select("id, request_id, image_url, url, uploaded_at, created_at")
    .in("professional_id", uniqueCandidateIds)
    .order("uploaded_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(Math.max(limit * 30, limit));
  const photos =
    (ph.data as Array<
      Database["public"]["Tables"]["service_photos"]["Row"] & {
        url?: string | null;
        uploaded_at?: string | null;
        created_at?: string | null;
      }
    > | null) ?? [];
  const photosByReq = new Map<
    string,
    { photos: string[]; latest: string | null }
  >();
  for (const p of photos) {
    const rid = typeof p.request_id === "string" ? p.request_id : null;
    if (!rid) continue;
    const rawUrl = (p as any).url || p.image_url;
    const u = typeof rawUrl === "string" ? rawUrl : null;
    if (!u) continue;
    const entry = photosByReq.get(rid) || { photos: [], latest: null };
    if (entry.photos.length < 6) entry.photos.push(u);
    const rawTimestamp = (p as any).uploaded_at || p.created_at || null;
    const ts = typeof rawTimestamp === "string" ? rawTimestamp : null;
    if (ts && (!entry.latest || ts > entry.latest)) entry.latest = ts;
    photosByReq.set(rid, entry);
  }

  const completedRequestsRes = await supa
    .from("requests")
    .select("id, title, status, updated_at, created_at")
    .in("professional_id", uniqueCandidateIds)
    .in("status", COMPLETED_REQUEST_STATUSES)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(limit * 3);

  const completedRequests =
    (completedRequestsRes.data as Array<{
      id: string;
      title?: string | null;
      updated_at?: string | null;
      created_at?: string | null;
    }> | null) ?? [];

  const jobMap = new Map<string, JobItem>();

  for (const request of completedRequests) {
    jobMap.set(request.id, {
      request_id: request.id,
      request_title: request.title || "",
      photos: photosByReq.get(request.id)?.photos ?? [],
      completed_at:
        photosByReq.get(request.id)?.latest ??
        request.updated_at ??
        request.created_at ??
        null,
    });
  }

  for (const [requestId, details] of photosByReq.entries()) {
    if (jobMap.has(requestId)) continue;
    jobMap.set(requestId, {
      request_id: requestId,
      request_title: "",
      photos: details.photos,
      completed_at: details.latest,
    });
  }

  const requestIdsMissingTitles = Array.from(jobMap.values())
    .filter((job) => !job.request_title.trim())
    .map((job) => job.request_id);

  if (requestIdsMissingTitles.length) {
    const titlesRes = await supa
      .from("requests")
      .select("id, title, updated_at, created_at")
      .in("id", requestIdsMissingTitles);
    const titleRows =
      (titlesRes.data as Array<{
        id: string;
        title?: string | null;
        updated_at?: string | null;
        created_at?: string | null;
      }> | null) ?? [];
    for (const row of titleRows) {
      const existing = jobMap.get(row.id);
      if (!existing) continue;
      existing.request_title = row.title || existing.request_title;
      existing.completed_at =
        existing.completed_at ?? row.updated_at ?? row.created_at ?? null;
      jobMap.set(row.id, existing);
    }
  }

  return Array.from(jobMap.values())
    .sort((a, b) => {
      const av = a.completed_at || "";
      const bv = b.completed_at || "";
      return av < bv ? 1 : av > bv ? -1 : 0;
    })
    .slice(0, limit);
}
