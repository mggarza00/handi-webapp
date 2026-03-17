import { getAdminSupabase } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";

export type ClientPublicProfile = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "full_name" | "avatar_url" | "created_at" | "city" | "bio" | "is_client_pro"
> & { id: string };

export type ReviewLite = Pick<
  Database["public"]["Tables"]["reviews"]["Row"],
  "id" | "rating" | "comment" | "created_at"
> & { request_id?: string };

export type ClientRequestLite = Pick<
  Database["public"]["Tables"]["requests"]["Row"],
  | "id"
  | "title"
  | "description"
  | "created_at"
  | "status"
  | "city"
  | "category"
  | "required_at"
>;

export type ClientData = {
  profile: ClientPublicProfile | null;
  ratingSummary: { count: number; average: number | null };
  recentReviews: Array<ReviewLite & { request_title?: string | null }>;
  requests: Array<ClientRequestLite & { proReview?: ReviewLite | null }>;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string | null;
  city: string | null;
  bio: string | null;
  is_client_pro: boolean | null;
};

type RequestRow = {
  id: string;
  title: string | null;
  description: string | null;
  created_at: string | null;
  status: string | null;
  city: string | null;
  category: string | null;
  required_at: string | null;
};

type ReviewRow = {
  id: string;
  request_id: string | null;
  rating: number | null;
  comment: string | null;
  created_at: string | null;
};

export async function getClientData(clientId: string): Promise<ClientData> {
  const admin = getAdminSupabase();

  const { data: p } = await admin
    .from("profiles")
    .select("id, full_name, avatar_url, created_at, city, bio, is_client_pro")
    .eq("id", clientId)
    .maybeSingle<ProfileRow>();

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
    const nums = (agg.data as Array<{ rating: number | null }>)
      .map((r) => (typeof r.rating === "number" ? r.rating : null))
      .filter((n): n is number => n != null);
    if (nums.length > 0) {
      const sum = nums.reduce((a, b) => a + b, 0);
      average = sum / nums.length;
    }
  }

  const { data: reqs } = await admin
    .from("requests")
    .select(
      "id, title, description, created_at, status, city, category, required_at",
    )
    .eq("created_by", clientId)
    .order("created_at", { ascending: false });

  const requestRows = (reqs ?? []) as unknown as RequestRow[];
  const requests: ClientRequestLite[] = requestRows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    created_at: r.created_at,
    status: r.status,
    city: r.city,
    category: r.category,
    required_at: r.required_at,
  }));

  const byReq = new Map<string, ReviewLite>();
  if (requests.length > 0) {
    const ids = requests.map((r) => r.id);
    const { data: proRevs } = await admin
      .from("reviews")
      .select(
        "id, request_id, rating, comment, created_at, reviewer_role, client_id",
      )
      .eq("client_id", clientId)
      .eq("reviewer_role", "pro")
      .in("request_id", ids);
    const proReviewRows = (proRevs ?? []) as unknown as ReviewRow[];
    for (const rv of proReviewRows) {
      if (!rv.request_id) continue;
      byReq.set(rv.request_id, {
        id: rv.id,
        rating: rv.rating,
        comment: rv.comment,
        created_at: rv.created_at,
        request_id: rv.request_id,
      });
    }
  }

  const requestsWithReview = requests.map((r) => ({
    ...r,
    proReview: byReq.get(String(r.id)) ?? null,
  }));

  const titleByRequestId = new Map<string, string>();
  for (const request of requests) {
    titleByRequestId.set(
      String(request.id),
      String(request.title || "Solicitud"),
    );
  }

  const recentReviewRows = (recent.data ?? []) as unknown as ReviewRow[];

  return {
    profile: p
      ? {
          id: p.id,
          full_name: p.full_name,
          avatar_url: p.avatar_url,
          created_at: p.created_at,
          city: p.city,
          bio: p.bio,
          is_client_pro: p.is_client_pro,
        }
      : null,
    ratingSummary: { count, average },
    recentReviews: recentReviewRows.map((x) => ({
      id: x.id,
      rating: x.rating,
      comment: x.comment,
      created_at: x.created_at,
      request_id: x.request_id || undefined,
      request_title: x.request_id
        ? (titleByRequestId.get(x.request_id) ?? null)
        : null,
    })),
    requests: requestsWithReview,
  };
}
