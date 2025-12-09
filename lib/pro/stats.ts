"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@/utils/supabase/server";
import { fetchExploreRequests } from "@/lib/db/requests";

export type Interval = "week" | "fortnight" | "month";
export type EarningsPoint = { label: string; amount: number };

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
    const avg_rating =
      typeof prof?.rating === "number" ? (prof.rating as number) : 0;
    const avatar_url = (prof?.avatar_url as string | null) ?? null;
    const city = (prof?.city as string | null) ?? null;
    const state = (prof?.state as string | null) ?? null;
    let is_company = false;
    try {
      const { data: proMeta } = await (supa as any)
        .from("professionals")
        .select("is_company")
        .eq("id", userId)
        .maybeSingle();
      if (proMeta && typeof proMeta.is_company !== "undefined") {
        is_company = Boolean(
          (proMeta as { is_company?: boolean | null }).is_company,
        );
      }
    } catch {
      is_company = false;
    }

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
    // Use agreements as source of truth for pro-request linkage
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
    const completedStatuses = ["completed", "finalizada", "paid", "finished"];
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

    // Try direct payments by pro_id
    const fromMin = ranges[0].from.toISOString();
    const toMax = ranges[ranges.length - 1].to.toISOString();
    let payments: Array<{
      amount: number;
      created_at: string;
      paid_at?: string | null;
      request_id?: string | null;
    }> = [];
    try {
      const { data } = await (supa as any)
        .from("payments")
        .select("amount, created_at, paid_at, request_id, pro_id")
        .eq("pro_id", userId)
        .gte("created_at", fromMin)
        .lte("created_at", toMax);
      if (Array.isArray(data)) payments = data as any[];
    } catch {
      // Fallback path below
    }
    if (!Array.isArray(payments) || payments.length === 0) {
      // Fallback: derive payments by requests linked to pro via agreements
      const { data: agrs } = await (supa as any)
        .from("agreements")
        .select("request_id")
        .eq("professional_id", userId)
        .in("status", ["accepted", "paid", "in_progress", "completed"]);
      const reqIds = Array.from(
        new Set(((agrs as any[]) || []).map((a) => String(a.request_id))),
      );
      if (reqIds.length > 0) {
        const { data: pays } = await (supa as any)
          .from("payments")
          .select("amount, created_at, paid_at, request_id")
          .in("request_id", reqIds)
          .gte("created_at", fromMin)
          .lte("created_at", toMax);
        payments = Array.isArray(pays) ? (pays as any[]) : [];
      }
    }

    const sums = new Map<string, number>();
    for (const r of ranges) sums.set(r.label, 0);
    for (const p of payments) {
      const when = p.paid_at || p.created_at;
      if (!when) continue;
      const ts = new Date(when);
      for (const r of ranges) {
        if (ts >= r.from && ts < r.to) {
          const cur = sums.get(r.label) || 0;
          const amt = typeof p.amount === "number" ? p.amount : 0;
          sums.set(r.label, cur + amt);
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
      profile,
      inProgress,
      completed,
      potentials,
      seriesWeek,
      seriesFort,
      seriesMonth,
    ] = await Promise.all([
      getProProfile(userId),
      getJobsInProgress(userId, 100),
      getJobsCompleted(userId, 100),
      getPotentialJobs(userId, 5),
      getEarningsSeries(userId, "week"),
      getEarningsSeries(userId, "fortnight"),
      getEarningsSeries(userId, "month"),
    ]);
    const sumLast = (s: EarningsPoint[]) =>
      s.length ? s[s.length - 1].amount : 0;
    return {
      completed_count: completed.length,
      in_progress_count: inProgress.length,
      potential_available_count: potentials.length,
      earnings_week: sumLast(seriesWeek),
      earnings_fortnight: sumLast(seriesFort),
      earnings_month: sumLast(seriesMonth),
      avg_rating:
        typeof profile.avg_rating === "number" ? profile.avg_rating : 0,
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
