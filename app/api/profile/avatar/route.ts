import { NextResponse } from "next/server";
import { z } from "zod";

import createClient from "@/utils/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const BodySchema = z.object({
  url: z.string().url().min(1),
});

export async function POST(req: Request) {
  try {
    const supa = createClient();
    const {
      data: { user },
    } = await supa.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHENTICATED" },
        { status: 401, headers: JSONH },
      );
    }

    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "BAD_REQUEST", detail: parsed.error.flatten() },
        { status: 400, headers: JSONH },
      );
    }
    const { url } = parsed.data;

    // Only allow URLs from our public avatars bucket to avoid hotlinking external hosts
    // Example: https://<project>.supabase.co/storage/v1/object/public/avatars/<userId>.<ext>
    const u = new URL(url);
    const isSupabase = /\.supabase\.co$/.test(u.hostname);
    const inAvatarsBucket = u.pathname.includes("/storage/v1/object/public/avatars/");
    if (!isSupabase || !inAvatarsBucket) {
      return NextResponse.json(
        { ok: false, error: "INVALID_URL" },
        { status: 400, headers: JSONH },
      );
    }

    const admin = getAdminSupabase();
    const { error } = await admin.from("profiles").update({ avatar_url: url }).eq("id", user.id);
    if (error) {
      return NextResponse.json(
        { ok: false, error: "DB_ERROR", detail: error.message },
        { status: 500, headers: JSONH },
      );
    }

    return NextResponse.json({ ok: true }, { headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", detail: msg },
      { status: 500, headers: JSONH },
    );
  }
}

export function GET() {
  return NextResponse.json(
    { ok: false, error: "METHOD_NOT_ALLOWED" },
    { status: 405, headers: JSONH },
  );
}

