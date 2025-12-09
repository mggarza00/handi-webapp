import { NextResponse } from "next/server";
import { z } from "zod";
import createClient from "@/utils/supabase/server";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const Body = z.object({
  proId: z.string().uuid(),
  favorite: z.boolean().default(true),
});

export async function POST(req: Request) {
  try {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const clientId = auth?.user?.id ?? null;
    if (!clientId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers: JSONH });

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, headers: JSONH });
    const { proId, favorite } = parsed.data;

    if (favorite) {
      const ins = await supabase
        .from("client_favorites")
        .insert({ client_id: clientId, pro_id: proId } as any);
      if (ins.error) {
        const m = (ins.error.message || "").toLowerCase();
        const missing = /not exist|not found|schema cache|relation .* does not exist/.test(m);
        if (missing) {
          return NextResponse.json({ error: "MIGRATION_REQUIRED: client_favorites" }, { status: 428, headers: JSONH });
        }
        // ignore unique/duplicate errors
        if (!/duplicate|unique/.test(m))
          return NextResponse.json({ error: ins.error.message }, { status: 400, headers: JSONH });
      }
      return NextResponse.json({ ok: true, is_favorite: true }, { status: 200, headers: JSONH });
    }

    const del = await supabase
      .from("client_favorites")
      .delete()
      .eq("client_id", clientId)
      .eq("pro_id", proId);
    if (del.error) {
      const m = (del.error.message || "").toLowerCase();
      const missing = /not exist|not found|schema cache|relation .* does not exist/.test(m);
      if (missing) {
        return NextResponse.json({ error: "MIGRATION_REQUIRED: client_favorites" }, { status: 428, headers: JSONH });
      }
      return NextResponse.json({ error: del.error.message }, { status: 400, headers: JSONH });
    }
    return NextResponse.json({ ok: true, is_favorite: false }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json({ error: msg }, { status: 500, headers: JSONH });
  }
}
