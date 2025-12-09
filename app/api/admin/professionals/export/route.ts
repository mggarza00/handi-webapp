import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Row = {
  id: string;
  full_name: string;
  city: string | null;
  kyc_status: "pending" | "accepted" | "rejected";
  rating: number | null;
  created_at: string;
};

function toCSV(rows: Row[]): string {
  const esc = (v: unknown) => {
    const s = (v ?? "").toString();
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ["id", "full_name", "city", "kyc_status", "rating", "created_at"].join(",");
  const lines = rows.map((r) => [r.id, r.full_name, r.city || "", r.kyc_status, r.rating ?? "", r.created_at].map(esc).join(","));
  return [header, ...lines].join("\n");
}

export async function GET(req: Request) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  const url = new URL(req.url);
  const status = (url.searchParams.get("status") || "").toLowerCase();
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!svcKey) {
    const mock: Row[] = Array.from({ length: 20 }).map((_, i) => ({
      id: crypto.randomUUID(),
      full_name: `Profesional ${i + 1}`,
      city: ["CDMX", "Monterrey", "Guadalajara"][i % 3]!,
      kyc_status: ["pending", "accepted", "rejected"][i % 3] as Row["kyc_status"],
      rating: Math.random() > 0.2 ? +(3 + Math.random() * 2).toFixed(1) as unknown as number : null,
      created_at: new Date(Date.now() - i * 86_400_000).toISOString(),
    }));
    const csv = toCSV(mock);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=professionals.csv",
        "Cache-Control": "no-store",
      },
    });
  }

  const admin = getAdminSupabase();
  let q = admin
    .from("pro_applications")
    .select("user_id, status, updated_at, created_at")
    .order("updated_at", { ascending: false })
    .limit(1000);
  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: JSONH });

  const userIds = Array.from(new Set((data || []).map((a) => a.user_id)));
  const { data: profs } = await admin.from("profiles").select("id, full_name, city, rating").in("id", userIds);
  const map = new Map((profs || []).map((p) => [p.id as string, p]));

  const rows: Row[] = (data || []).map((a) => ({
    id: a.user_id as string,
    full_name: ((map.get(a.user_id as string)?.full_name as string | null) || `Usuario ${a.user_id.slice(0, 6)}`) as string,
    city: (map.get(a.user_id as string)?.city as string | null) || null,
    kyc_status: (a.status as Row["kyc_status"]) || "pending",
    rating: (map.get(a.user_id as string)?.rating as number | null) || null,
    created_at: (a.updated_at || a.created_at || new Date().toISOString()) as string,
  }));

  const csv = toCSV(rows);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=professionals.csv",
      "Cache-Control": "no-store",
    },
  });
}

