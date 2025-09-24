import { NextResponse } from "next/server";
import { z } from "zod";

import type { Database } from "@/types/supabase";
import { createServerClient } from "@/lib/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
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
    // Load applications for this request
    const { data: apps, error } = await supa
      .from("applications")
      .select("id, status, created_at, professional_id")
      .eq("request_id", requestId)
      .order("created_at", { ascending: true });
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: JSONH },
      );
    }

    const list = (apps ?? []) as Array<{
      id: string;
      status: string | null;
      created_at: string | null;
      professional_id: string;
    }>;

    // Enrich with professional name/headline/rating (best-effort)
    const profIds = Array.from(new Set(list.map((a) => a.professional_id)));
    const proNames = new Map<string, string | null>();
    const proRatings = new Map<string, number | null>();
    const proHeadlines = new Map<string, string | null>();
    if (profIds.length) {
      const [{ data: pros }, { data: profs }] = await Promise.all([
        supa.from("professionals").select("id, full_name, headline, rating").in("id", profIds),
        supa.from("profiles").select("id, full_name").in("id", profIds),
      ]);
      for (const p of pros ?? []) {
        const id = (p as unknown as { id: string }).id;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        proNames.set(id, ((p as any).full_name as string) || null);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        proRatings.set(id, (p as any).rating as number | null);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        proHeadlines.set(id, ((p as any).headline as string) || null);
      }
      for (const p of profs ?? []) {
        const id = (p as unknown as { id: string }).id;
        if (!proNames.has(id)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          proNames.set(id, ((p as any).full_name as string) || null);
        }
      }
    }

    const data = list.map((a) => ({
      id: a.id,
      note: null as string | null, // column may not exist in all snapshots
      status: a.status,
      created_at: a.created_at,
      professional_id: a.professional_id,
      pro_full_name: proNames.get(a.professional_id) ?? null,
      pro_rating: proRatings.get(a.professional_id) ?? null,
      pro_headline: proHeadlines.get(a.professional_id) ?? null,
    }));

    return NextResponse.json({ ok: true, data }, { headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "INTERNAL_ERROR";
    return NextResponse.json(
      { error: msg },
      { status: 500, headers: JSONH },
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

