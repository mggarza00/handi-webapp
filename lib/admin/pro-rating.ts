import { getAdminSupabase } from "@/lib/supabase/server";

type RatingAgg = {
  ratingAvg: number | null;
  reviewsCount: number;
};

export async function getRatingsForPros(
  ids: string[],
): Promise<Record<string, RatingAgg>> {
  if (!ids.length) return {};

  const admin = getAdminSupabase();

  const agg: Record<string, { sum: number; count: number }> = {};
  let rows: Array<{ to_user_id?: string | null; stars?: number | null }> = [];

  try {
    const { data } = await admin
      .from("ratings")
      .select("to_user_id, stars")
      .in("to_user_id", ids);
    rows = (data as typeof rows) || [];
  } catch {
    return {};
  }

  for (const row of rows) {
    const id = row?.to_user_id ? String(row.to_user_id) : "";
    if (!id) continue;
    const stars = Number(row.stars ?? 0);
    if (!agg[id]) agg[id] = { sum: 0, count: 0 };
    agg[id].sum += stars;
    agg[id].count += 1;
  }

  const out: Record<string, RatingAgg> = {};
  for (const id of Object.keys(agg)) {
    const { sum, count } = agg[id];
    out[id] = {
      ratingAvg: count ? Math.round((sum / count) * 10) / 10 : null,
      reviewsCount: count,
    };
  }
  return out;
}
