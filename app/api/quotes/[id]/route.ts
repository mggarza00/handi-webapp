import { NextResponse } from "next/server";
import { getDevUserFromHeader, getUserFromRequestOrThrow } from "@/lib/auth-route";
import { createServerClient } from "@/lib/supabase";
import { getSignedUrl } from "@/lib/storage/quotes";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    let user = (await getDevUserFromHeader(_req))?.user ?? null;
    if (!user) ({ user } = await getUserFromRequestOrThrow(_req));
    const admin = createServerClient();
    const id = (params?.id || "").trim();
    if (!id) return NextResponse.json({ ok: false, error: "MISSING_ID" }, { status: 400, headers: JSONH });
    const { data: quote } = await admin
      .from("quotes")
      .select("*, conversation_id, professional_id, client_id")
      .eq("id", id)
      .maybeSingle();
    if (!quote) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: JSONH });
    // Validate participation
    const { data: conv } = await admin
      .from("conversations")
      .select("id, customer_id, pro_id")
      .eq("id", (quote as any).conversation_id)
      .maybeSingle();
    if (!conv) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403, headers: JSONH });
    const uid = user.id;
    if (uid !== (conv as any).customer_id && uid !== (conv as any).pro_id)
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403, headers: JSONH });

    let image_url: string | null = null;
    const image_path = (quote as any).image_path as string | null;
    if (image_path) image_url = await getSignedUrl(image_path, 600);

    return NextResponse.json({ ok: true, data: quote, image_url }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json({ ok: false, error: msg }, { status: 400, headers: JSONH });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

