import { NextResponse } from "next/server";
import { z } from "zod";

import { createServerClient } from "@/lib/supabase";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

type AgreementRow = Pick<
  Database["public"]["Tables"]["agreements"]["Row"],
  "id" | "professional_id" | "amount" | "status" | "created_at" | "updated_at"
>;

type ProfessionalRow = Pick<
  Database["public"]["Tables"]["professionals"]["Row"],
  "id" | "full_name" | "avatar_url"
>;

type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "full_name" | "avatar_url"
>;

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const Id = z.string().uuid();
    const parsed = Id.safeParse(params?.id);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "INVALID_ID" },
        { status: 400, headers: JSONH },
      );
    }
    const requestId = parsed.data;
    const supa = createServerClient();
    const { data, error } = await supa
      .from("agreements")
      .select("id, professional_id, amount, status, created_at, updated_at")
      .eq("request_id", requestId)
      .order("updated_at", { ascending: false, nullsFirst: false });
    if (error)
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: JSONH },
      );
    const list = (data ?? []) as AgreementRow[];
    const professionalIds = Array.from(
      new Set(
        list
          .map((item) => item.professional_id)
          .filter(
            (id): id is string => typeof id === "string" && id.length > 0,
          ),
      ),
    );

    let pros: ProfessionalRow[] = [];
    let profiles: ProfileRow[] = [];
    if (professionalIds.length) {
      const admin = getAdminSupabase();
      const [{ data: proRows }, { data: profileRows }] = await Promise.all([
        admin
          .from("professionals")
          .select("id, full_name, avatar_url")
          .in("id", professionalIds),
        admin
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", professionalIds),
      ]);
      pros = (proRows ?? []) as ProfessionalRow[];
      profiles = (profileRows ?? []) as ProfileRow[];
    }

    const proMap = new Map(pros.map((row) => [row.id, row]));
    const profileMap = new Map(profiles.map((row) => [row.id, row]));

    const enriched = list.map((row) => {
      const pro = row.professional_id
        ? (proMap.get(row.professional_id) ?? null)
        : null;
      const profile = row.professional_id
        ? (profileMap.get(row.professional_id) ?? null)
        : null;
      const professional = row.professional_id
        ? {
            id: row.professional_id,
            full_name: pro?.full_name || profile?.full_name || null,
            avatar_url: pro?.avatar_url || profile?.avatar_url || null,
          }
        : null;
      return { ...row, professional };
    });

    return NextResponse.json(
      { ok: true, data: enriched },
      { status: 200, headers: JSONH },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "INTERNAL_ERROR";
    return NextResponse.json({ error: msg }, { status: 500, headers: JSONH });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
