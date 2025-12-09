import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AdminPro = {
  id: string;
  full_name: string;
  city: string | null;
  kyc_status: "pending" | "approved" | "rejected";
  rating: number | null;
  created_at: string;
};

function fake(n: number): AdminPro[] {
  const arr: AdminPro[] = [];
  for (let i = 0; i < n; i++) {
    arr.push({
      id: crypto.randomUUID(),
      full_name: `Profesional ${i + 1}`,
      city: ["CDMX", "Monterrey", "Guadalajara"][i % 3],
      kyc_status: ["pending", "approved", "rejected"][i % 3] as AdminPro["kyc_status"],
      rating: Math.random() > 0.2 ? +(3 + Math.random() * 2).toFixed(1) : null,
      created_at: new Date(Date.now() - i * 86_400_000).toISOString(),
    });
  }
  return arr;
}

export async function GET(req: Request) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  const url = new URL(req.url);
  const kyc = (url.searchParams.get("kyc") || "").toLowerCase();
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!svcKey) {
    const all = fake(20);
    const items = kyc ? all.filter((p) => p.kyc_status === (kyc === 'observed' ? 'rejected' : (kyc as 'pending'|'approved'|'rejected'))) : all;
    return NextResponse.json({ ok: true, items }, { headers: JSONH });
  }

  const admin = getAdminSupabase();
  // Tomar últimas solicitudes de pro_applications como fuente de KYC
  const { data: apps, error } = await admin
    .from("pro_applications")
    .select("user_id, status, updated_at, created_at")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: JSONH });

  const userIds = Array.from(new Set((apps || []).map((a) => a.user_id)));
  const { data: profs } = await admin.from("profiles").select("id, full_name, city, rating").in("id", userIds);
  const info = new Map((profs || []).map((p) => [p.id as string, p]));

  const normalize = (s: unknown): 'pending'|'approved'|'rejected'|'needs_info' => {
    const x = String(s || '').toLowerCase();
    if (x === 'accepted' || x === 'approved') return 'approved';
    if (x === 'rejected') return 'rejected';
    if (x === 'needs_info' || x === 'observed') return 'needs_info';
    return 'pending';
  };

  const items = (apps || [])
    .filter((a: { status?: string }) => {
      if (!kyc) return true;
      const st = normalize(a?.status);
      if (kyc === 'observed') return st === 'needs_info';
      return st === (kyc as 'pending'|'approved'|'rejected');
    })
    .map((a: { user_id: string; status?: string; updated_at?: string | null; created_at?: string | null }) => {
      const p = info.get(a.user_id);
      return {
        id: a.user_id,
        full_name: (p?.full_name as string | null) || `Usuario ${a.user_id.slice(0, 6)}`,
        city: (p?.city as string | null) || null,
        kyc_status: ((() => { const st = normalize(a?.status); return st === 'needs_info' ? 'pending' : (st as 'pending'|'approved'|'rejected'); })()),
        rating: (p?.rating as number | null) || null,
        created_at: (a.updated_at || a.created_at || new Date().toISOString()) as string,
      } satisfies AdminPro;
    });
  return NextResponse.json({ ok: true, items }, { headers: JSONH });
}
