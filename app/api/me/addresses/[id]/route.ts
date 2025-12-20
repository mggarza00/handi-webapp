import { NextResponse } from "next/server";
import { z } from "zod";
import getRouteClient from "@/lib/supabase/route-client";
import { createServerClient } from "@/lib/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const PatchSchema = z.object({
  address: z.string().min(5).max(500).optional(),
  label: z.string().min(1).max(120).optional().or(z.literal("")).optional(),
});

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(_req: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = getRouteClient() as any;
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id || null;
    if (!userId) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401, headers: JSONH });

    const body = await _req.json().catch(() => ({}));
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json({ ok: false, error: "VALIDATION_ERROR", detail: parsed.error.flatten() }, { status: 422, headers: JSONH });

    const updates: Record<string, unknown> = {};
    const b = parsed.data as Record<string, unknown>;
    if (typeof b.address === "string") updates.address = (b.address as string).trim();
    if (typeof b.label === "string") updates.label = ((b.label as string).trim() || null);

    // First try user_saved_addresses (RLS)
    const { data: savedRow } = await supabase
      .from("user_saved_addresses")
      .select("id,address_line,label,last_used_at,times_used")
      .eq("id", params.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (savedRow) {
      const payload = {
        ...(updates.address ? { address_line: updates.address } : {}),
        ...(updates.label !== undefined ? { label: updates.label } : {}),
      };
      const { data, error } = await supabase
        .from("user_saved_addresses")
        .update(payload)
        .eq("id", params.id)
        .eq("user_id", userId)
        .select("id,address_line,label,last_used_at,times_used")
        .single();
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400, headers: JSONH });
      return NextResponse.json(
        {
          ok: true,
          item: {
            id: data.id,
            address: data.address_line,
            city: null,
            postal_code: null,
            label: data.label,
            lat: null,
            lon: null,
            times_used: data.times_used ?? 0,
            last_used_at: data.last_used_at ?? "",
          },
        },
        { status: 200, headers: JSONH },
      );
    }

    // Legacy table user_addresses (RLS)
    const { data, error } = await supabase
      .from("user_addresses")
      .update(updates)
      .eq("id", params.id)
      .select("id,address,city,postal_code,label,lat,lon,times_used,last_used_at")
      .single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400, headers: JSONH });
    return NextResponse.json({ ok: true, item: data }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: JSONH });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const userClient = getRouteClient() as any;
    const { data: auth } = await userClient.auth.getUser();
    const userId = auth?.user?.id || null;
    if (!userId) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401, headers: JSONH });

    // Try deleting from user_saved_addresses first (has RLS delete policy)
    const { data: savedRow } = await userClient
      .from("user_saved_addresses")
      .select("id")
      .eq("id", params.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (savedRow?.id) {
      const delSaved = await userClient
        .from("user_saved_addresses")
        .delete()
        .eq("id", params.id)
        .eq("user_id", userId);
      if (delSaved.error)
        return NextResponse.json(
          { ok: false, error: delSaved.error.message },
          { status: 400, headers: JSONH },
        );
      return NextResponse.json({ ok: true }, { status: 200, headers: JSONH });
    }

    // Legacy table user_addresses (no delete policy, use service role)
    const { data: row } = await userClient
      .from("user_addresses")
      .select("id")
      .eq("id", params.id)
      .maybeSingle();
    if (!row) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: JSONH });

    const admin = createServerClient() as any;
    const delLegacy = await admin.from("user_addresses").delete().eq("id", params.id);
    if (delLegacy.error)
      return NextResponse.json(
        { ok: false, error: delLegacy.error.message },
        { status: 400, headers: JSONH },
      );
    return NextResponse.json({ ok: true }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: JSONH });
  }
}
