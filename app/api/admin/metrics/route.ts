import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!svcKey) {
    // Mock si no hay service role
    const url = new URL(req.url);
    const range = parseInt(url.searchParams.get("range") || "14", 10);
    const len = Number.isFinite(range) && range > 0 ? Math.min(range, 60) : 14;
    const today = new Date();
    const trend = Array.from({ length: len }).map((_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (len - 1 - i));
      return { date: d.toISOString().slice(0, 10), requests: Math.floor(8 + Math.random() * 20) };
    });
    const series = trend.map((t) => ({ ...t, payments: Math.max(0, Math.floor(t.requests * (0.3 + Math.random() * 0.2))) }));
    const kpis = {
      requestsToday: trend[len - 1]?.requests || 0,
      conversionRate: Math.floor(30 + Math.random() * 50),
      paymentsToday: Math.floor(2000 + Math.random() * 20000),
      payoutsPending: Math.floor(Math.random() * 25),
      activeProfessionals: Math.floor(50 + Math.random() * 300),
      slaAvgHours: Math.floor(8 + Math.random() * 48),
      openTickets: Math.floor(Math.random() * 50),
    } as const;
    return NextResponse.json({ ok: true, kpis, trend, series }, { headers: JSONH });
  }

  const admin = getAdminSupabase();
  const url = new URL(req.url);
  const range = parseInt(url.searchParams.get("range") || "14", 10);
  const fromP = url.searchParams.get("from");
  const toP = url.searchParams.get("to");

  const now = toP ? new Date(toP) : new Date();
  const start = fromP
    ? new Date(fromP)
    : (() => {
        const len = Number.isFinite(range) && range > 0 ? Math.min(range, 60) : 14;
        const s = new Date(now);
        s.setDate(now.getDate() - (len - 1));
        return s;
      })();
  start.setHours(0, 0, 0, 0);
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const startPayments = new Date(now);
  startPayments.setDate(now.getDate() - Math.max(30, Math.ceil((now.getTime() - start.getTime()) / 86_400_000)));
  startPayments.setHours(0, 0, 0, 0);

  // Requests últimos 14 días
  const { data: reqs14 } = await admin
    .from("requests")
    .select("created_at, status")
    .gte("created_at", start.toISOString())
    .lte("created_at", now.toISOString());

  // KPI: hoy
  const { data: reqsToday } = await admin
    .from("requests")
    .select("id")
    .gte("created_at", startToday.toISOString());

  // (mantenemos consultas mínimas solo para tendencia)

  // KPI: totalPayments ≈ suma de offers pagadas últimos 30 días (fallback)
  const { data: offersPaid } = await admin
    .from("offers")
    .select("amount, status, created_at")
    .eq("status", "paid")
    .gte("created_at", startPayments.toISOString())
    .lte("created_at", now.toISOString());

  const byDay = new Map<string, number>();
  const byDayPay = new Map<string, number>();
  const totalDays = Math.floor((now.getTime() - start.getTime()) / 86_400_000) + 1;
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    byDay.set(key, 0);
    byDayPay.set(key, 0);
  }
  for (const r of reqs14 || []) {
    const key = new Date(r.created_at as string).toISOString().slice(0, 10);
    if (byDay.has(key)) byDay.set(key, (byDay.get(key) || 0) + 1);
  }
  // Payments per day (count of 'paid')
  const { data: paysRange } = await admin
    .from('payments')
    .select('created_at, status')
    .gte('created_at', start.toISOString())
    .lte('created_at', now.toISOString());
  for (const p of paysRange || []) {
    const key = new Date((p as { created_at: string }).created_at).toISOString().slice(0, 10);
    const st = String((p as { status: string }).status);
    if (st === 'paid') byDayPay.set(key, (byDayPay.get(key) || 0) + 1);
  }
  const trend = Array.from(byDay.entries()).map(([date, requests]) => ({ date, requests }));
  const series = trend.map((t) => ({ ...t, payments: byDayPay.get(t.date) || 0 }));

  const _totalPayments = (offersPaid || []).reduce((sum, o) => sum + (o.amount as number), 0);

  // KPIs adicionales: pagos hoy (monto) y conversión 30d (paid/offered)
  const { data: payToday } = await admin
    .from('payments')
    .select('amount, created_at, status')
    .gte('created_at', startToday.toISOString())
    .lte('created_at', now.toISOString());
  const paymentsToday = (payToday || [])
    .filter((p) => ['paid','refunded','succeeded'].includes(String((p as { status: string }).status)))
    .reduce((s, p) => s + Number((p as { amount: number }).amount || 0), 0);

  const { data: offersLast30 } = await admin
    .from('offers')
    .select('status, created_at')
    .gte('created_at', startPayments.toISOString())
    .lte('created_at', now.toISOString());
  const offered = (offersLast30 || []).filter((o) => String((o as { status: string }).status) === 'sent').length;
  const paid = (offersLast30 || []).filter((o) => String((o as { status: string }).status) === 'paid').length;
  const conversionRate = offered > 0 ? Math.round((paid / offered) * 100) : 0;

  const { data: payoutsPendingRows } = await admin
    .from('payments')
    .select('id')
    .eq('status', 'pending');
  const payoutsPending = (payoutsPendingRows || []).length;

  // Profesionales activos (aprobados) si existe tabla professionals
  let activeProfessionals = 0;
  try {
    const { data: prosCount } = await admin
      .from('professionals')
      .select('id, kyc_status')
      .eq('kyc_status', 'approved');
    activeProfessionals = (prosCount || []).length;
  } catch {
    // ignore if table does not exist
  }

  // SLA promedio (horas) a partir de jobs programados en los últimos 30d
  let slaAvgHours = 0;
  try {
    const { data: jobs } = await admin
      .from('jobs')
      .select('requested_at, scheduled_for')
      .not('scheduled_for', 'is', null)
      .gte('requested_at', startPayments.toISOString())
      .lte('requested_at', now.toISOString())
      .limit(1000);
    const diffs = (jobs || [])
      .map((j) => {
        const a = new Date(j.requested_at as string).getTime();
        const b = new Date(j.scheduled_for as string).getTime();
        return Math.max(0, (b - a) / 3600000);
      })
      .filter((n) => Number.isFinite(n));
    if (diffs.length > 0) slaAvgHours = Math.round(diffs.reduce((s, n) => s + n, 0) / diffs.length);
  } catch {
    // ignore if table does not exist
  }
  const body = {
    ok: true,
    kpis: {
      requestsToday: (reqsToday || []).length,
      conversionRate,
      paymentsToday,
      payoutsPending,
      activeProfessionals,
      slaAvgHours,
    },
    trend,
    series,
  } as const;
  return NextResponse.json(body, { headers: JSONH });
}
