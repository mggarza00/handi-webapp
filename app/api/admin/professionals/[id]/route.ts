import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { getAdminSupabase } from "@/lib/supabase/server";
import { getRatingsForPros } from "@/lib/admin/pro-rating";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ProfilePayload = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  rating: number | null;
  categories: string[];
  cities: string[];
};

type KPI = {
  inProgressCount: number;
  completedCount: number;
  totalEarnings: number;
  paymentsCount: number;
  ratingAvg: number;
  reviewsCount: number;
};

function normalizeStringArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "string" ? v : String(v || "")))
      .map((v) => v.trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return normalizeStringArray(parsed);
    } catch {
      return [trimmed];
    }
  }
  return [];
}

function fake(id: string) {
  return {
    ok: true,
    data: {
      profile: {
        id,
        full_name: "Profesional Demo",
        email: "pro@handi.mx",
        phone: "+52 81 0000 0000",
        rating: 4.6,
        categories: ["Plomeria", "Electricidad"],
        cities: ["Monterrey", "San Pedro"],
      } satisfies ProfilePayload,
      kpis: {
        inProgressCount: 3,
        completedCount: 18,
        totalEarnings: 24500,
        paymentsCount: 22,
        ratingAvg: 4.6,
        reviewsCount: 34,
      } satisfies KPI,
      inProgress: [
        {
          request_id: "req_demo_1",
          title: "Instalacion electrica",
          status: "in_progress",
          updated_at: new Date().toISOString(),
        },
      ],
      completed: [
        {
          request_id: "req_demo_2",
          title: "Reparacion de fuga",
          status: "completed",
          completed_at: new Date(Date.now() - 86_400_000).toISOString(),
        },
      ],
    },
  };
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!svcKey) {
    return NextResponse.json(fake(params.id), { headers: JSONH });
  }

  const admin = getAdminSupabase();
  const userId = params.id;

  const { data: pro } = await admin
    .from("professionals")
    .select("id, full_name, rating, cities, categories, subcategories")
    .eq("id", userId)
    .maybeSingle();

  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name, email, phone")
    .eq("id", userId)
    .maybeSingle();

  const { data: app } = await admin
    .from("pro_applications")
    .select(
      "full_name, email, phone, cities, categories, subcategories, updated_at",
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const categories =
    normalizeStringArray(pro?.categories) ||
    normalizeStringArray(pro?.subcategories) ||
    normalizeStringArray(app?.categories) ||
    normalizeStringArray(app?.subcategories);
  const cities =
    normalizeStringArray(pro?.cities) || normalizeStringArray(app?.cities);

  const baseProfile: ProfilePayload = {
    id: userId,
    full_name:
      (profile?.full_name as string | null) ||
      (pro?.full_name as string | null) ||
      (app?.full_name as string | null) ||
      null,
    email:
      (profile?.email as string | null) ||
      (app?.email as string | null) ||
      null,
    phone:
      (profile?.phone as string | null) ||
      (app?.phone as string | null) ||
      null,
    rating: (pro?.rating as number | null) || null,
    categories: categories || [],
    cities: cities || [],
  };

  let inProgressCount = 0;
  let completedCount = 0;
  let totalEarnings = 0;
  let paymentsCount = 0;
  let usedAgreements = false;
  let offersCount = 0;

  const inProgress: Array<{
    request_id: string;
    title: string;
    status: string | null;
    updated_at: string | null;
  }> = [];
  const completed: Array<{
    request_id: string;
    title: string;
    status: string | null;
    completed_at: string | null;
  }> = [];

  try {
    const { data: agreements } = await admin
      .from("agreements")
      .select("id, status, amount, request_id, updated_at, created_at")
      .eq("professional_id", userId)
      .order("updated_at", { ascending: false })
      .limit(500);
    if (Array.isArray(agreements) && agreements.length > 0) {
      usedAgreements = true;
      const inProgressStatuses = new Set([
        "negotiating",
        "accepted",
        "paid",
        "in_progress",
      ]);
      const completedStatuses = new Set(["completed"]);
      let sum = 0;
      let payCount = 0;
      for (const row of agreements) {
        const status = String(row.status || "");
        if (inProgressStatuses.has(status)) inProgressCount += 1;
        if (completedStatuses.has(status)) completedCount += 1;
        if (status === "paid" || status === "completed") {
          sum += Number(row.amount ?? 0);
          payCount += 1;
        }
      }
      totalEarnings = sum;
      paymentsCount = payCount;

      const inProgressRows = agreements
        .filter((r) => inProgressStatuses.has(String(r.status || "")))
        .slice(0, 5);
      const completedRows = agreements
        .filter((r) => completedStatuses.has(String(r.status || "")))
        .slice(0, 5);
      const ids = Array.from(
        new Set(
          [...inProgressRows, ...completedRows]
            .map((r) => String(r.request_id))
            .filter(Boolean),
        ),
      );
      let titlesByReq = new Map<string, string>();
      if (ids.length > 0) {
        const { data: reqs } = await admin
          .from("requests")
          .select("id, title")
          .in("id", ids);
        titlesByReq = new Map(
          (reqs || []).map((r) => [String(r.id), String(r.title || "")]),
        );
      }
      for (const row of inProgressRows) {
        inProgress.push({
          request_id: String(row.request_id),
          title: titlesByReq.get(String(row.request_id)) || "Servicio",
          status: (row.status as string | null) ?? null,
          updated_at:
            (row.updated_at as string | null) ??
            (row.created_at as string | null) ??
            null,
        });
      }
      for (const row of completedRows) {
        completed.push({
          request_id: String(row.request_id),
          title: titlesByReq.get(String(row.request_id)) || "Servicio",
          status: (row.status as string | null) ?? null,
          completed_at:
            (row.updated_at as string | null) ??
            (row.created_at as string | null) ??
            null,
        });
      }
    }
  } catch {
    /* ignore */
  }

  if (!usedAgreements) {
    try {
      const { data: offers } = await admin
        .from("offers")
        .select("id, status, amount, currency, request_id, created_at")
        .eq("professional_id", userId)
        .order("created_at", { ascending: false })
        .limit(500);
      const rows =
        (offers as Array<{
          status?: string | null;
          amount?: number | null;
          request_id?: string | null;
          created_at?: string | null;
        }> | null) || [];
      offersCount = rows.length;
      const inProgressStatuses = new Set(["accepted", "paid"]);
      for (const row of rows) {
        const status = String(row.status || "");
        if (inProgressStatuses.has(status)) inProgressCount += 1;
        if (status === "paid") {
          totalEarnings += Number(row.amount ?? 0);
          paymentsCount += 1;
        }
      }
      const inProgressRows = rows
        .filter((r) => inProgressStatuses.has(String(r.status || "")))
        .slice(0, 5);
      const ids = Array.from(
        new Set(
          inProgressRows.map((r) => String(r.request_id)).filter(Boolean),
        ),
      );
      let titlesByReq = new Map<string, string>();
      if (ids.length > 0) {
        const { data: reqs } = await admin
          .from("requests")
          .select("id, title")
          .in("id", ids);
        titlesByReq = new Map(
          (reqs || []).map((r) => [String(r.id), String(r.title || "")]),
        );
      }
      for (const row of inProgressRows) {
        inProgress.push({
          request_id: String(row.request_id),
          title: titlesByReq.get(String(row.request_id)) || "Servicio",
          status: (row.status as string | null) ?? null,
          updated_at: (row.created_at as string | null) ?? null,
        });
      }
    } catch {
      /* ignore */
    }
  }

  if (!usedAgreements && completed.length === 0) {
    try {
      const { count } = await admin
        .from("requests")
        .select("id", { count: "exact", head: true })
        .eq("professional_id", userId)
        .in("status", ["completed", "finished", "finalizada"]);
      if (typeof count === "number") completedCount = count;
    } catch {
      /* ignore */
    }
    try {
      const { count } = await admin
        .from("pro_calendar_events")
        .select("id", { count: "exact", head: true })
        .eq("pro_id", userId)
        .in("status", ["completed", "finished"]);
      if (typeof count === "number" && count > completedCount) {
        completedCount = count;
      }
    } catch {
      /* ignore */
    }
  }

  let ratingAvg = 0;
  let reviewsCount = 0;
  try {
    const map = await getRatingsForPros([userId]);
    const agg = map[userId];
    if (agg) {
      ratingAvg = agg.ratingAvg ?? 0;
      reviewsCount = agg.reviewsCount ?? 0;
    } else if (typeof baseProfile.rating === "number") {
      ratingAvg = baseProfile.rating;
    }
  } catch {
    if (typeof baseProfile.rating === "number") ratingAvg = baseProfile.rating;
  }

  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log("[admin:pro-kpis]", {
      proId: userId,
      usedAgreements,
      offersCount,
      inProgressCount,
      completedCount,
    });
  }

  const kpis: KPI = {
    inProgressCount,
    completedCount,
    totalEarnings: Math.round(totalEarnings * 100) / 100,
    paymentsCount,
    ratingAvg: Number.isFinite(ratingAvg) ? Math.round(ratingAvg * 10) / 10 : 0,
    reviewsCount,
  };

  return NextResponse.json(
    {
      ok: true,
      data: {
        profile: baseProfile,
        kpis,
        inProgress,
        completed,
      },
    },
    { headers: JSONH },
  );
}
