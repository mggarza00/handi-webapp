import { NextResponse } from "next/server";
import getRouteClient from "@/lib/supabase/route-client";
import { z } from "zod";

import { getUserOrThrow } from "@/lib/_supabase-server";
import type { Database } from "@/types/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const CreateSchema = z.object({
  request_id: z.string().uuid(),
  peer_id: z.string().uuid(),
});

export async function GET() {
  try {
    const supabase = getRouteClient();
    const { user } = await getUserOrThrow(supabase);
    const { data, error } = await supabase
      .from("conversations")
      .select("id, request_id, customer_id, pro_id, last_message_at, created_at")
      .or(`customer_id.eq.${user.id},pro_id.eq.${user.id}`)
      .order("last_message_at", { ascending: false });
    if (error)
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400, headers: JSONH },
      );
    return NextResponse.json({ ok: true, data: data ?? [] }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    return NextResponse.json({ ok: false, error: msg }, { status: 401, headers: JSONH });
  }
}

export async function POST(req: Request) {
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json"))
      return NextResponse.json(
        { ok: false, error: "UNSUPPORTED_MEDIA_TYPE" },
        { status: 415, headers: JSONH },
      );

    const supabase = getRouteClient();
    const { user } = await getUserOrThrow(supabase);
    const parsed = CreateSchema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json(
        { ok: false, error: "VALIDATION_ERROR", detail: parsed.error.flatten() },
        { status: 422, headers: JSONH },
      );
    const { request_id, peer_id } = parsed.data;

    const tryUpsert = async (customer_id: string, pro_id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("conversations")
        .upsert(
          [
            {
              request_id,
              customer_id,
              pro_id,
            },
          ],
          { onConflict: "request_id,customer_id,pro_id" },
        )
        .select("id, request_id, customer_id, pro_id, last_message_at, created_at")
        .single();
      return { data, error } as const;
    };

    const first = await tryUpsert(user.id, peer_id);
    const data = first.data;
    const error = first.error;
    if (error && /unique|duplicate/i.test(error.message)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = await (supabase as any)
        .from("conversations")
        .select("id, request_id, customer_id, pro_id, last_message_at, created_at")
        .eq("request_id", request_id)
        .eq("customer_id", peer_id)
        .eq("pro_id", user.id)
        .maybeSingle();
      if (q.data) return NextResponse.json({ ok: true, data: q.data }, { status: 200, headers: JSONH });
    }
    if (error) {
      const alt = await tryUpsert(peer_id, user.id);
      if (alt.data) return NextResponse.json({ ok: true, data: alt.data }, { status: 200, headers: JSONH });
      return NextResponse.json(
        { ok: false, error: alt.error?.message || error.message },
        { status: 400, headers: JSONH },
      );
    }
    return NextResponse.json({ ok: true, data }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    return NextResponse.json({ ok: false, error: msg }, { status: 401, headers: JSONH });
  }
}
