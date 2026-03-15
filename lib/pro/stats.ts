"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@/utils/supabase/server";
import { fetchExploreRequests } from "@/lib/db/requests";

export type Interval = "week" | "fortnight" | "month";
export type EarningsPoint = { label: string; amount: number };

async function getAvgRating(userId: string): Promise<number> {
  try {
    const supa = createClient();
    const { data, error } = await (supa as any)
      .from("ratings")
      .select("avg:avg(stars)")
      .eq("to_user_id", userId)
      .maybeSingle();
    if (error) throw error;
    const raw = (data as { avg?: unknown } | null)?.avg;
    const val = typeof raw === "number" ? raw : Number(raw ?? 0);
    return Number.isFinite(val) ? val : 0;
  } catch {
    return 0;
  }
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
    const supa = createClient();
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
    const supa = createClient();
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
    const supa = createClient();
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
  try {
    const supa = createClient();
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
    if (!error && typeof count === "number") return count;
  } catch {
    /* ignore */
  }
  return 0;
}

async function getCompletedCount(userId: string): Promise<number> {
  try {
    const supa = createClient();
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
    if (!error && typeof count === "number") return count;
  } catch {
    /* ignore */
  }
  return 0;
}

function startOfWeek(d: Date): Date {
  const date = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const day = date.getUTCDay(); // 0..6 (Sun..Sat)
  const diff = (day + 6) % 7; // make Monday = 0
  date.setUTCDate(date.getUTCDate() - diff);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function formatLabel(
  date: Date,
  interval: Interval,
  _indexInRange: number,
): string {
  const y = date.getUTCFullYear();
  if (interval === "week") {
    // ISO week number approximation by counting Mondays since year start
    const jan1 = new Date(Date.UTC(y, 0, 1));
    const monday = startOfWeek(date);
    const diffDays = Math.floor(
      (monday.getTime() - startOfWeek(jan1).getTime()) / (1000 * 60 * 60 * 24),
    );
    const week = Math.floor(diffDays / 7) + 1;
    return `${y}-W${String(week).padStart(2, "0")}`;
  }
  if (interval === "fortnight") {
    const month = date.getUTCMonth() + 1;
    const quincena = date.getUTCDate() <= 15 ? 1 : 2;
    return `${y}-${String(month).padStart(2, "0")}-Q${quincena}`;
  }
  const month = date.getUTCMonth() + 1;
  return `${y}-${String(month).padStart(2, "0")}`;
}

function getPeriodBoundaries(
  interval: Interval,
  periods = 6,
): Array<{ from: Date; to: Date; label: string }> {
  const out: Array<{ from: Date; to: Date; label: string }> = [];
  const now = new Date();
  let cursor: Date;
  if (interval === "week") cursor = startOfWeek(now);
  else if (interval === "fortnight") {
    cursor = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() <= 15 ? 1 : 16,
      ),
    );
    cursor.setUTCHours(0, 0, 0, 0);
  } else {
    cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    cursor.setUTCHours(0, 0, 0, 0);
  }
  for (let i = 0; i < periods; i++) {
    const from = new Date(cursor);
    let to = new Date(cursor);
    if (interval === "week") {
      to = new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
    } else if (interval === "fortnight") {
      // 1-15 and 16-end
      if (from.getUTCDate() === 1) {
        to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 16));
      } else {
        to = new Date(
          Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1),
        );
      }
    } else {
      to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
    }
    out.unshift({ from, to, label: formatLabel(from, interval, i) });
    // Move cursor to previous interval
    if (interval === "week") {
      cursor = new Date(from.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (interval === "fortnight") {
      if (from.getUTCDate() === 1)
        cursor = new Date(
          Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - 1, 16),
        );
      else
        cursor = new Date(
          Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1),
        );
    } else {
      cursor = new Date(
        Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - 1, 1),
      );
    }
  }
  return out;
}

export async function getEarningsSeries(
  userId: string,
  interval: Interval,
): Promise<EarningsPoint[]> {
  try {
    const supa = createClient();
    const ranges = getPeriodBoundaries(interval, 6);

    const fromMin = ranges[0].from.toISOString();
    const toMax = ranges[ranges.length - 1].to.toISOString();

    const { data: agreements } = await (supa as any)
      .from("agreements")
      .select("request_id, completed_at, updated_at")
      .eq("professional_id", userId)
      .eq("status", "completed")
      .or(
        `and(completed_at.gte.${fromMin},completed_at.lt.${toMax}),and(updated_at.gte.${fromMin},updated_at.lt.${toMax})`,
      );

    const rows = (agreements as any[]) || [];
    const reqIds = Array.from(
      new Set(rows.map((r) => String(r.request_id)).filter(Boolean)),
    );

    const netByRequest = new Map<string, number>();
    if (reqIds.length > 0) {
      const { data: receipts } = await (supa as any)
        .from("receipts")
        .select(
          "request_id, service_amount_cents, commission_amount_cents, created_at, professional_id",
        )
        .eq("professional_id", userId)
        .in("request_id", reqIds)
        .order("created_at", { ascending: false });
      for (const r of (receipts as any[]) || []) {
        const rid = String(r.request_id || "");
        if (!rid || netByRequest.has(rid)) continue;
        const service = Number(r.service_amount_cents ?? 0);
        const commission = Number(r.commission_amount_cents ?? 0);
        const net = (service - commission) / 100;
        netByRequest.set(rid, Number.isFinite(net) ? net : 0);
      }
    }

    const sums = new Map<string, number>();
    for (const r of ranges) sums.set(r.label, 0);
    for (const a of rows) {
      const when = a.completed_at || a.updated_at;
      if (!when) continue;
      const ts = new Date(when);
      for (const r of ranges) {
        if (ts >= r.from && ts < r.to) {
          const cur = sums.get(r.label) || 0;
          const net = netByRequest.get(String(a.request_id)) || 0;
          sums.set(r.label, cur + net);
          break;
        }
      }
    }

    return ranges.map((r) => ({
      label: r.label,
      amount: Math.max(0, Math.round((sums.get(r.label) || 0) * 100) / 100),
    }));
  } catch {
    return [];
  }
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
  try {
    const [
      inProgressCount,
      completedCount,
      potentialTotal,
      avgRating,
      seriesWeek,
      seriesFort,
      seriesMonth,
    ] = await Promise.all([
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
      completed_count: completedCount,
      in_progress_count: inProgressCount,
      potential_available_count: potentialTotal,
      earnings_week: sumLast(seriesWeek),
      earnings_fortnight: sumLast(seriesFort),
      earnings_month: sumLast(seriesMonth),
      avg_rating: Number.isFinite(avgRating) ? avgRating : 0,
    };
  } catch {
    return {
      completed_count: 0,
      in_progress_count: 0,
      potential_available_count: 0,
      earnings_week: 0,
      earnings_fortnight: 0,
      earnings_month: 0,
      avg_rating: 0,
    };
  }
}
