import { NextResponse } from "next/server";

import { assertAdminOrJson } from "@/lib/auth-admin";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Row = { date: string; requests: number };

function toCSV(rows: Row[]): string {
  const header = "date,requests";
  const lines = rows.map((r) => `${r.date},${r.requests}`);
  return [header, ...lines].join("\n");
}

export async function GET(req: Request) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  const url = new URL(req.url);
  const range = parseInt(url.searchParams.get("range") || "14", 10);
  const fromP = url.searchParams.get("from");
  const toP = url.searchParams.get("to");

  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!svcKey) {
    // Mock serie si no hay Service Role
    const today = new Date();
    const len = Number.isFinite(range) && range > 0 ? Math.min(range, 60) : 14;
    const trend = Array.from({ length: len }).map((_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (len - 1 - i));
      return { date: d.toISOString().slice(0, 10), requests: Math.floor(8 + Math.random() * 20) };
    });
    const csv = toCSV(trend);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=metrics_trend.csv",
        "Cache-Control": "no-store",
      },
    });
  }

  const admin = getAdminSupabase();
  let start: Date;
  const end: Date = toP ? new Date(toP) : new Date();
  if (fromP) {
    start = new Date(fromP);
  } else {
    const len = Number.isFinite(range) && range > 0 ? Math.min(range, 60) : 14;
    start = new Date(end);
    start.setDate(end.getDate() - (len - 1));
  }
  // Normaliza horas
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const { data: reqs } = await admin
    .from("requests")
    .select("created_at")
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString());

  const byDay = new Map<string, number>();
  const totalDays = Math.floor((end.getTime() - start.getTime()) / (24 * 3600_000)) + 1;
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    byDay.set(d.toISOString().slice(0, 10), 0);
  }
  for (const r of reqs || []) {
    const key = new Date(r.created_at as string).toISOString().slice(0, 10);
    if (byDay.has(key)) byDay.set(key, (byDay.get(key) || 0) + 1);
  }

  const rows: Row[] = Array.from(byDay.entries()).map(([date, requests]) => ({ date, requests }));
  const csv = toCSV(rows);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=metrics_trend.csv",
      "Cache-Control": "no-store",
    },
  });
}
