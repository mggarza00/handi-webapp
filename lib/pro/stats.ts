"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { fetchExploreRequests } from "@/lib/db/requests";
import {
  buildPayoutSeries,
  type EarningsSeriesPoint,
  type PayoutSeriesInterval,
} from "@/lib/pro/payout-earnings";
import {
  getProfessionalRatingSummary,
  normalizeProfessionalRating,
} from "@/lib/professionals/ratings";
import { getAdminSupabase } from "@/lib/supabase/admin";
import getServerClient from "@/lib/supabase/server-client";

export type Interval = PayoutSeriesInterval;
export type EarningsPoint = EarningsSeriesPoint;

type ProDashboardIdentity = {
  professionalId: string;
  profileId: string;
  payoutProfessionalIds: string[];
};

const getStatsSupabaseClients = (): any[] => {
  const clients: any[] = [];
  try {
    // Dashboard aggregates should prefer admin reads. The SSR client can be
    // RLS-limited and return empty successful responses, which would
    // incorrectly zero out the KPIs before reaching the service-role client.
    clients.push(getAdminSupabase());
  } catch {
    /* ignore */
  }
  try {
    clients.push(getServerClient());
  } catch {
    /* ignore */
  }
  return clients;
};

async function withSupabaseFallback<T>(
  read: (supa: any) => Promise<T | null | undefined>,
  fallback: T,
): Promise<T> {
  for (const supa of getStatsSupabaseClients()) {
    try {
      const result = await read(supa);
      if (result !== null && result !== undefined) return result;
    } catch {
      /* ignore */
    }
  }
  return fallback;
}

function normalizeId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function uniqueIds(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value))),
  );
}

async function resolveProDashboardIdentity(
  supa: any,
  userId: string,
): Promise<ProDashboardIdentity> {
  const normalizedUserId = normalizeId(userId) ?? userId;
  const fallback: ProDashboardIdentity = {
    professionalId: normalizedUserId,
    profileId: normalizedUserId,
    payoutProfessionalIds: [normalizedUserId],
  };

  const readProfessional = async (column: "id" | "user_id") => {
    const { data, error } = await (supa as any)
      .from("professionals")
      .select("id, user_id")
      .eq(column, normalizedUserId)
      .maybeSingle();
    if (error) return null;
    return data as { id?: unknown; user_id?: unknown } | null;
  };

  try {
    const professional =
      (await readProfessional("id")) ?? (await readProfessional("user_id"));
    if (!professional) return fallback;

    const professionalId = normalizeId(professional.id) ?? normalizedUserId;
    const profileId = normalizeId(professional.user_id) ?? normalizedUserId;

    return {
      professionalId,
      profileId,
      payoutProfessionalIds: uniqueIds([
        professionalId,
        profileId,
        normalizedUserId,
      ]),
    };
  } catch {
    return fallback;
  }
}

async function getAvgRating(userId: string): Promise<number> {
  return withSupabaseFallback<number>(async (supa) => {
    const identity = await resolveProDashboardIdentity(supa, userId);
    const [profileResult, summaryResult] = await Promise.allSettled([
      (supa as any)
        .from("profiles")
        .select("rating")
        .eq("id", identity.profileId)
        .maybeSingle(),
      getProfessionalRatingSummary(supa as any, identity.professionalId),
    ]);

    const legacyRating =
      profileResult.status === "fulfilled" && !profileResult.value.error
        ? normalizeProfessionalRating(
            (profileResult.value.data as { rating?: unknown } | null)?.rating,
          )
        : null;
    const canonicalRating =
      summaryResult.status === "fulfilled" && summaryResult.value.count > 0
        ? summaryResult.value.average
        : null;
    const resolved = canonicalRating ?? legacyRating;

    return resolved !== null && Number.isFinite(resolved) ? resolved : 0;
  }, 0);
}

export async function getProProfile(userId: string): Promise<{
  id: string;
  full_name: string | null;
  first_name: string | null;
  greeting_preference?: "bienvenido" | "bienvenida" | "neutral" | null;
  avg_rating: number;
  avatar_url: string | null;
  city: string | null;
  state: string | null;
  is_company: boolean;
  subcategories: string[];
}> {
  try {
    const supa = getAdminSupabase();
    const { data: prof } = await (supa as any)
      .from("profiles")
      .select(
        "id, full_name, first_name, greeting_preference, rating, avatar_url, city, state",
      )
      .eq("id", userId)
      .maybeSingle();
    const full_name = (prof?.full_name as string | null) ?? null;
    const first_name = (prof?.first_name as string | null) ?? null;
    const greeting_preference =
      (prof?.greeting_preference as
        | "bienvenido"
        | "bienvenida"
        | "neutral"
        | null) ?? null;
    const avg_rating = await getAvgRating(userId);
    const avatar_url = (prof?.avatar_url as string | null) ?? null;
    const state = (prof?.state as string | null) ?? null;
    let proCity: string | null = null;
    let proSubcategories: string[] = [];

    const toSubcategoryNames = (value: unknown): string[] => {
      if (!value) return [];
      if (Array.isArray(value)) {
        return value
          .map((v) =>
            typeof v === "string" ? v : (v as { name?: string })?.name || "",
          )
          .map((v) => v?.toString().trim())
          .filter((v): v is string => Boolean(v));
      }
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return [];
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) return toSubcategoryNames(parsed);
        } catch {
          /* ignore JSON parse errors */
        }
        return [trimmed];
      }
      return [];
    };

    let is_company = false;
    try {
      const { data: proMeta } = await (supa as any)
        .from("professionals")
        .select("is_company, city, subcategories")
        .eq("id", userId)
        .maybeSingle();
      if (proMeta) {
        if (typeof proMeta.is_company !== "undefined") {
          is_company = Boolean(
            (proMeta as { is_company?: boolean | null }).is_company,
          );
        }
        if (typeof proMeta.city !== "undefined") {
          proCity = (proMeta as { city?: string | null }).city ?? null;
        }
        proSubcategories = toSubcategoryNames(
          (proMeta as { subcategories?: unknown }).subcategories ?? null,
        );
      }
    } catch {
      is_company = false;
      proCity = null;
      proSubcategories = [];
    }
    const city =
      (proCity as string | null) ?? (prof?.city as string | null) ?? null;
    const subcategories = proSubcategories;

    return {
      id: (prof?.id as string | null) ?? userId,
      full_name,
      first_name,
      greeting_preference,
      avg_rating,
      avatar_url,
      city,
      state,
      is_company,
      subcategories,
    };
  } catch {
    return {
      id: userId,
      full_name: null,
      first_name: null,
      greeting_preference: null,
      avg_rating: 0,
      avatar_url: null,
      city: null,
      state: null,
      is_company: false,
      subcategories: [],
    };
  }
}

export async function getJobsInProgress(
  userId: string,
  limit = 5,
): Promise<
  Array<{
    id: string;
    request_id: string;
    title: string;
    status: string | null;
    updated_at: string | null;
  }>
> {
  try {
    const supa = getAdminSupabase();
    // Prefer calendar events when available (post-pago source of truth)
    try {
      const { data: calendar, error: calError } = await (supa as any)
        .from("pro_calendar_events")
        .select("request_id, title, scheduled_date, scheduled_time, status")
        .eq("pro_id", userId)
        .in("status", ["scheduled", "in_process"])
        .order("scheduled_date", { ascending: false, nullsFirst: false })
        .order("scheduled_time", { ascending: false, nullsFirst: false })
        .limit(Math.max(1, limit));
      if (!calError && Array.isArray(calendar) && calendar.length > 0) {
        return (calendar as any[]).map((r) => ({
          id: String(r.request_id),
          request_id: String(r.request_id),
          title: String(r.title || "Servicio"),
          status: (r.status as string | null) ?? null,
          updated_at: (r.scheduled_date as string | null) ?? null,
        }));
      }
    } catch {
      /* ignore and fallback */
    }
    // Fallback to agreements for legacy data
    const { data, error } = await (supa as any)
      .from("agreements")
      .select("id, request_id, status, updated_at, requests:title")
      .eq("professional_id", userId)
      .in("status", ["in_progress", "paid", "accepted"]) // pragmatic definition of in-progress
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(Math.max(1, limit));
    if (error) throw error;
    const ids = ((data as any[]) || []).map((r) => String(r.request_id));
    let titlesByReq = new Map<string, string>();
    if (ids.length > 0) {
      const { data: reqs } = await (supa as any)
        .from("requests")
        .select("id, title")
        .in("id", ids);
      titlesByReq = new Map(
        ((reqs as any[]) || []).map((r) => [
          String(r.id),
          String(r.title || ""),
        ]),
      );
    }
    return ((data as any[]) || []).map((r) => ({
      id: String(r.id),
      request_id: String(r.request_id),
      title: titlesByReq.get(String(r.request_id)) || "Servicio",
      status: (r.status as string | null) ?? null,
      updated_at: (r.updated_at as string | null) ?? null,
    }));
  } catch {
    return [];
  }
}

export async function getJobsCompleted(
  userId: string,
  limit = 5,
): Promise<
  Array<{
    id: string;
    request_id: string;
    title: string;
    completed_at: string | null;
  }>
> {
  try {
    const supa = getAdminSupabase();
    const completedStatuses = ["completed", "finalizada", "finished"];
    // Prefer calendar events when available
    try {
      const { data: calendar, error: calError } = await (supa as any)
        .from("pro_calendar_events")
        .select("request_id, title, scheduled_date, status")
        .eq("pro_id", userId)
        .in("status", ["finished", "completed"])
        .order("scheduled_date", { ascending: false, nullsFirst: false })
        .limit(Math.max(1, limit));
      if (!calError && Array.isArray(calendar) && calendar.length > 0) {
        return (calendar as any[]).map((r) => ({
          id: String(r.request_id),
          request_id: String(r.request_id),
          title: String(r.title || "Servicio"),
          completed_at: (r.scheduled_date as string | null) ?? null,
        }));
      }
    } catch {
      /* ignore and fallback */
    }
    const { data, error } = await (supa as any)
      .from("agreements")
      .select("id, request_id, completed_at, status")
      .eq("professional_id", userId)
      .in("status", completedStatuses as any[])
      .order("completed_at", { ascending: false, nullsFirst: false })
      .limit(Math.max(1, limit));
    if (error) throw error;
    const agreementRows = ((data as any[]) || []).filter((r) => r?.request_id);
    const ids = agreementRows.map((r) => String(r.request_id));
    let titlesByReq = new Map<string, string>();
    if (ids.length > 0) {
      const { data: reqs } = await (supa as any)
        .from("requests")
        .select("id, title")
        .in("id", ids);
      titlesByReq = new Map(
        ((reqs as any[]) || []).map((r) => [
          String(r.id),
          String(r.title || ""),
        ]),
      );
    }
    const primary = agreementRows.map((r) => ({
      id: String(r.id),
      request_id: String(r.request_id),
      title: titlesByReq.get(String(r.request_id)) || "Servicio",
      completed_at: (r.completed_at as string | null) ?? null,
    }));

    // Fallback: requests table where status indicates finished work for this pro
    if (primary.length >= limit) return primary.slice(0, limit);
    const seen = new Set(primary.map((r) => r.request_id));
    const remaining = Math.max(0, limit - primary.length);
    const { data: reqFallback } = await (supa as any)
      .from("requests")
      .select("id, title, completed_at, updated_at")
      .eq("professional_id", userId)
      .in("status", ["finished", "completed", "finalizada"] as any[])
      .order("completed_at", { ascending: false, nullsFirst: true })
      .limit(Math.max(1, remaining * 2)); // fetch a few extra to dedupe
    const fallbackRows = ((reqFallback as any[]) || [])
      .filter((r) => r?.id)
      .filter((r) => !seen.has(String(r.id)));
    const mappedFallback = fallbackRows.slice(0, remaining).map((r) => ({
      id: String(r.id),
      request_id: String(r.id),
      title: String(r.title || "Servicio"),
      completed_at:
        (r.completed_at as string | null) ??
        (r.updated_at as string | null) ??
        null,
    }));

    return [...primary, ...mappedFallback].slice(0, limit);
  } catch {
    return [];
  }
}

export async function getPotentialJobs(
  userId: string,
  limit = 5,
): Promise<
  Array<{
    id: string;
    title: string;
    city: string | null;
    category: string | null;
    created_at: string | null;
  }>
> {
  try {
    const { items } = await fetchExploreRequests(userId, {
      page: 1,
      pageSize: Math.max(1, limit),
    });
    return (items || []).map((it) => ({
      id: String(it.id),
      title: it.title,
      city: it.city ?? null,
      category: it.category ?? null,
      created_at: it.created_at ?? null,
    }));
  } catch {
    // TODO: fallback: read from requests where status = active and match city/category
    return [];
  }
}

async function getPotentialJobsTotal(userId: string): Promise<number> {
  try {
    const { total } = await fetchExploreRequests(userId, {
      page: 1,
      pageSize: 1,
    });
    return Number.isFinite(total) ? total : 0;
  } catch {
    return 0;
  }
}

async function getInProgressCount(userId: string): Promise<number> {
  return withSupabaseFallback<number>(async (supa) => {
    try {
      const { count, error } = await (supa as any)
        .from("pro_calendar_events")
        .select("id", { count: "exact", head: true })
        .eq("pro_id", userId)
        .in("status", ["scheduled", "in_process"]);
      if (!error && typeof count === "number") return count;
    } catch {
      /* ignore and fallback */
    }
    const { count, error } = await (supa as any)
      .from("agreements")
      .select("id", { count: "exact", head: true })
      .eq("professional_id", userId)
      .in("status", ["in_progress", "paid", "accepted"]);
    if (error) return null;
    return typeof count === "number" ? count : 0;
  }, 0);
}

async function getCompletedCount(userId: string): Promise<number> {
  return withSupabaseFallback<number>(async (supa) => {
    try {
      const { count, error } = await (supa as any)
        .from("pro_calendar_events")
        .select("id", { count: "exact", head: true })
        .eq("pro_id", userId)
        .in("status", ["finished", "completed"]);
      if (!error && typeof count === "number") return count;
    } catch {
      /* ignore and fallback */
    }
    const { count, error } = await (supa as any)
      .from("agreements")
      .select("id", { count: "exact", head: true })
      .eq("professional_id", userId)
      .eq("status", "completed");
    if (error) return null;
    return typeof count === "number" ? count : 0;
  }, 0);
}

export async function getEarningsSeries(
  userId: string,
  interval: Interval,
): Promise<EarningsPoint[]> {
  return withSupabaseFallback<EarningsPoint[]>(async (supa) => {
    const identity = await resolveProDashboardIdentity(supa, userId);
    const { data, error } = await (supa as any)
      .from("payouts")
      .select("paid_at, created_at, amount, status, professional_id")
      .in("professional_id", identity.payoutProfessionalIds)
      .in("status", ["paid", "completed"])
      .order("paid_at", { ascending: true, nullsFirst: false });
    if (error) return null;
    return buildPayoutSeries(
      Array.isArray(data)
        ? (data as Array<{
            paid_at: string | null;
            created_at: string | null;
            amount: number | null;
            status: string | null;
          }>)
        : [],
      interval,
    );
  }, []);
}

export async function getTotals(userId: string): Promise<{
  completed_count: number;
  in_progress_count: number;
  potential_available_count: number;
  earnings_week: number;
  earnings_fortnight: number;
  earnings_month: number;
  avg_rating: number;
}> {
  const [
    inProgressCount,
    completedCount,
    potentialTotal,
    avgRating,
    seriesWeek,
    seriesFort,
    seriesMonth,
  ] = await Promise.allSettled([
    getInProgressCount(userId),
    getCompletedCount(userId),
    getPotentialJobsTotal(userId),
    getAvgRating(userId),
    getEarningsSeries(userId, "week"),
    getEarningsSeries(userId, "fortnight"),
    getEarningsSeries(userId, "month"),
  ]);
  const sumLast = (s: EarningsPoint[]) =>
    s.length ? s[s.length - 1].amount : 0;
  return {
    completed_count:
      completedCount.status === "fulfilled" ? completedCount.value : 0,
    in_progress_count:
      inProgressCount.status === "fulfilled" ? inProgressCount.value : 0,
    potential_available_count:
      potentialTotal.status === "fulfilled" ? potentialTotal.value : 0,
    earnings_week:
      seriesWeek.status === "fulfilled" ? sumLast(seriesWeek.value) : 0,
    earnings_fortnight:
      seriesFort.status === "fulfilled" ? sumLast(seriesFort.value) : 0,
    earnings_month:
      seriesMonth.status === "fulfilled" ? sumLast(seriesMonth.value) : 0,
    avg_rating:
      avgRating.status === "fulfilled" && Number.isFinite(avgRating.value)
        ? avgRating.value
        : 0,
  };
}
