import { NextResponse } from "next/server";
import { z } from "zod";

import createClient from "@/utils/supabase/server";
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
    const supa = createClient();
    const { data: auth } = await supa.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401, headers: JSONH },
      );
    }

    let admin = null as ReturnType<typeof getAdminSupabase> | null;
    try {
      admin = getAdminSupabase();
    } catch {
      admin = null;
    }

    const requestClient = admin ?? supa;
    const { data: requestRow, error: requestError } = await requestClient
      .from("requests")
      .select("id, created_by, professional_id")
      .eq("id", requestId)
      .maybeSingle();
    if (requestError) {
      return NextResponse.json(
        { error: requestError.message },
        { status: 400, headers: JSONH },
      );
    }
    if (!requestRow) {
      return NextResponse.json(
        { error: "NOT_FOUND" },
        { status: 404, headers: JSONH },
      );
    }

    let allowed =
      requestRow.created_by === userId || requestRow.professional_id === userId;
    if (!allowed) {
      const { data: agr } = await requestClient
        .from("agreements")
        .select("id")
        .eq("request_id", requestId)
        .eq("professional_id", userId)
        .limit(1);
      if (Array.isArray(agr) && agr.length > 0) allowed = true;
    }

    if (!allowed && admin) {
      const { data: prof } = await admin
        .from("profiles")
        .select("role, is_admin")
        .eq("id", userId)
        .maybeSingle();
      allowed = (prof?.role ?? null) === "admin" || !!prof?.is_admin;
    }

    if (!allowed) {
      return NextResponse.json(
        { error: "FORBIDDEN" },
        { status: 403, headers: JSONH },
      );
    }

    const { data, error } = await requestClient
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
      const infoClient = admin ?? supa;
      const [{ data: proRows }, { data: profileRows }] = await Promise.all([
        infoClient
          .from("professionals")
          .select("id, full_name, avatar_url")
          .in("id", professionalIds),
        infoClient
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
