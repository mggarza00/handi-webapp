import { NextResponse } from "next/server";
import { z } from "zod";
import getRouteClient from "@/lib/supabase/route-client";
import { createServerClient } from "@/lib/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const PatchSchema = z.object({
  address: z.string().min(5).max(500).optional(),
  city: z.string().min(1).max(80).optional().or(z.literal("")).optional(),
  postal_code: z.string().min(1).max(40).optional().or(z.literal("")).optional(),
  label: z.string().min(1).max(120).optional().or(z.literal("")).optional(),
  lat: z.number().optional().nullable(),
  lon: z.number().optional().nullable(),
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
    if (typeof b.address === 'string') updates.address = (b.address as string).trim();
    if (typeof b.city === 'string') updates.city = ((b.city as string).trim() || null);
    if (typeof b.postal_code === 'string') updates.postal_code = ((b.postal_code as string).trim() || null);
    if (typeof b.label === 'string') updates.label = ((b.label as string).trim() || null);
    if (typeof b.lat === 'number' || b.lat === null) updates.lat = b.lat ?? null;
    if (typeof b.lon === 'number' || b.lon === null) updates.lon = b.lon ?? null;

    // RLS ensures the row belongs to the user
    const { data, error } = await supabase
      .from('user_addresses')
      .update(updates)
      .eq('id', params.id)
      .select('id,address,city,postal_code,label,lat,lon,times_used,last_used_at')
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
    // Verify row belongs to user via RLS-select
    const { data: row } = await userClient
      .from('user_addresses')
      .select('id')
      .eq('id', params.id)
      .single();
    if (!row) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404, headers: JSONH });

    // Use service role to delete (no delete policy defined)
    const admin = createServerClient() as any;
    const del = await admin.from('user_addresses').delete().eq('id', params.id);
    if (del.error) return NextResponse.json({ ok: false, error: del.error.message }, { status: 400, headers: JSONH });
    return NextResponse.json({ ok: true }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: JSONH });
  }
}

