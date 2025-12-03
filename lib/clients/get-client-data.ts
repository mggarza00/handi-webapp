import { getAdminSupabase } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";

export type ClientPublicProfile = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "full_name" | "avatar_url" | "created_at"
> & { id: string };

export type ReviewLite = Pick<
  Database["public"]["Tables"]["reviews"]["Row"],
  "id" | "rating" | "comment" | "created_at"
> & { request_id?: string };

export type ClientRequestLite = Pick<
  Database["public"]["Tables"]["requests"]["Row"],
  "id" | "title" | "description" | "created_at" | "status"
>;

export type ClientData = {
  profile: ClientPublicProfile | null;
  ratingSummary: { count: number; average: number | null };
  recentReviews: ReviewLite[];
  requests: Array<ClientRequestLite & { proReview?: ReviewLite | null }>;
};

export async function getClientData(clientId: string): Promise<ClientData> {
  const admin = getAdminSupabase();

  // 1) Perfil público (solo campos permitidos)
  const { data: p } = await admin
    .from("profiles")
    .select("id, full_name, avatar_url, created_at")
    .eq("id", clientId)
    .maybeSingle<{ id: string; full_name: string | null; avatar_url: string | null; created_at: string | null }>();

  // 2) Reseñas del cliente: últimas N y agregados
  const [recent, agg] = await Promise.all([
    admin
      .from("reviews")
      .select("id, request_id, rating, comment, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(5),
    admin
      .from("reviews")
      .select("rating", { count: "exact", head: false })
      .eq("client_id", clientId),
  ]);

  const count = (agg.count as number | null) ?? 0;
  let average: number | null = null;
  if (count > 0 && Array.isArray(agg.data)) {
    const nums = (agg.data as Array<{ rating: number }>).map((r) => r.rating);
    if (nums.length) {
      const sum = nums.reduce((a, b) => a + (typeof b === "number" ? b : 0), 0);
      average = sum / nums.length;
    }
  }

  // 3) Solicitudes del cliente
  const { data: reqs } = await admin
    .from("requests")
    .select("id, title, description, created_at, status")
    .eq("created_by", clientId)
    .order("created_at", { ascending: false });
  const requests: ClientRequestLite[] = (reqs ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    created_at: r.created_at,
    status: r.status,
  }));

  // 4) Reseña del profesional por cada solicitud (si existe)
  const byReq = new Map<string, ReviewLite>();
  if (requests.length > 0) {
    const ids = requests.map((r) => r.id);
    const { data: proRevs } = await admin
      .from("reviews")
      .select("id, request_id, rating, comment, created_at, reviewer_role, client_id")
      .eq("client_id", clientId)
      .eq("reviewer_role", "pro")
      .in("request_id", ids);
    for (const rv of proRevs ?? []) {
      byReq.set(rv.request_id as string, {
        id: rv.id,
        rating: rv.rating,
        comment: rv.comment,
        created_at: rv.created_at,
        request_id: rv.request_id,
      });
    }
  }

  const requestsWithReview = requests.map((r) => ({ ...r, proReview: byReq.get(r.id) ?? null }));

  return {
    profile: p ? { id: p.id, full_name: p.full_name, avatar_url: p.avatar_url, created_at: p.created_at } : null,
    ratingSummary: { count, average },
    recentReviews: (recent.data ?? []).map((x) => ({
      id: x.id,
      rating: x.rating,
      comment: x.comment,
      created_at: x.created_at,
      request_id: x.request_id,
    })),
    requests: requestsWithReview,
  };
}
