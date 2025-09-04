import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseServer } from "@/lib/_supabase-server";
import type { Database } from "@/types/supabase";

const IdParam = z.string().uuid();
const PatchSchema = z.object({
  status: z.enum(["active", "in_process", "completed", "cancelled"]).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(10_000).optional(),
  city: z.string().max(120).optional(),
  category: z.string().max(120).optional(),
  subcategories: z.array(z.string()).max(6).optional(),
  budget: z.number().nonnegative().nullable().optional(),
  required_at: z.string().datetime().optional(),
});

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: rid } = await params;
  const id = IdParam.safeParse(rid);
  if (!id.success) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400, headers: JSONH });
  }

  const supabase = getSupabaseServer();
  const { data, error } = await supabase.from("requests").select("*").eq("id", id.data).single();

  if (error) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND", detail: error.message }, { status: 404, headers: JSONH });
  }

  return NextResponse.json({ ok: true, data }, { headers: JSONH });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = getSupabaseServer();
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401, headers: JSONH });
    }

    const { id: rid } = await params;
    const id = IdParam.safeParse(rid);
    if (!id.success) {
      return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400, headers: JSONH });
    }

    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json")) {
      return NextResponse.json({ ok: false, error: "UNSUPPORTED_MEDIA_TYPE" }, { status: 415, headers: JSONH });
    }

    const body = await req.json();
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "VALIDATION_ERROR", detail: parsed.error.issues.map(i => i.message) },
        { status: 400, headers: JSONH },
      );
    }

    const patch: Database["public"]["Tables"]["requests"]["Update"] = { ...parsed.data } as Database["public"]["Tables"]["requests"]["Update"];
    if (parsed.data.required_at) patch.required_at = parsed.data.required_at.split("T")[0];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("requests")
      .update(patch)
      .eq("id", id.data)
      .select("*")
      .single();

    if (error) {
      const status = /permission|rls/i.test(error.message) ? 403 : 400;
      return NextResponse.json(
        { ok: false, error: "UPDATE_FAILED", detail: error.message, user_id: userId },
        { status, headers: JSONH },
      );
    }

    return NextResponse.json({ ok: true, data }, { status: 200, headers: JSONH });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNKNOWN";
    const status = (err as { status?: number })?.status ?? 500;
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR", detail: msg }, { status, headers: JSONH });
  }
}
