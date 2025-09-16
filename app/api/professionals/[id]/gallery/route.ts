import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

import type { Database } from "@/types/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

type CtxP = { params: Promise<{ id: string }> };
const IdSchema = z.string().uuid();

export async function GET(_req: Request, { params }: CtxP) {
  const { id } = await params;
  const parsed = IdSchema.safeParse(id);
  if (!parsed.success)
    return NextResponse.json(
      { ok: false, error: "INVALID_ID" },
      { status: 400, headers: JSONH },
    );

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as
    | string
    | undefined;
  if (!url || !serviceRole)
    return NextResponse.json(
      { ok: false, error: "SERVER_MISCONFIGURED" },
      { status: 500, headers: JSONH },
    );

  const admin = createClient<Database>(url, serviceRole);
  const prefix = `${parsed.data}/`;
  const { data, error } = await admin.storage
    .from("professionals-gallery")
    .list(prefix, {
      limit: 100,
      sortBy: { column: "updated_at", order: "desc" },
    });
  if (error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 400, headers: JSONH },
    );

  const items = await Promise.all(
    (data ?? [])
      .filter((x) => x && x.name)
      .map(async (obj) => {
        const path = `${prefix}${obj.name}`;
        const signed = await admin.storage
          .from("professionals-gallery")
          .createSignedUrl(path, 60 * 60) // 1 hora
          .catch(() => ({ data: null, error: null }));
        let url = signed?.data?.signedUrl || null;
        if (!url) {
          const pub = admin.storage
            .from("professionals-gallery")
            .getPublicUrl(path);
          url = pub.data.publicUrl;
        }
        return {
          path,
          name: obj.name,
          size: obj.metadata?.size ?? null,
          updated_at: obj.updated_at ?? null,
          url,
        } as const;
      }),
  );

  return NextResponse.json({ ok: true, data: items }, { headers: JSONH });
}

export async function DELETE(req: Request, { params }: CtxP) {
  const { id } = await params;
  const parsed = IdSchema.safeParse(id);
  if (!parsed.success)
    return NextResponse.json(
      { ok: false, error: "INVALID_ID" },
      { status: 400, headers: JSONH },
    );

  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path");
  if (!path)
    return NextResponse.json(
      { ok: false, error: "MISSING_PATH" },
      { status: 400, headers: JSONH },
    );
  if (!path.startsWith(`${parsed.data}/`))
    return NextResponse.json(
      { ok: false, error: "FORBIDDEN" },
      { status: 403, headers: JSONH },
    );

  const supabase = createRouteHandlerClient<Database>({ cookies });
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id ?? null;
  if (!uid || uid !== parsed.data)
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401, headers: JSONH },
    );

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as
    | string
    | undefined;
  if (!url || !serviceRole)
    return NextResponse.json(
      { ok: false, error: "SERVER_MISCONFIGURED" },
      { status: 500, headers: JSONH },
    );
  const admin = createClient<Database>(url, serviceRole);
  const { error } = await admin.storage
    .from("professionals-gallery")
    .remove([path]);
  if (error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 400, headers: JSONH },
    );
  return NextResponse.json({ ok: true }, { headers: JSONH });
}

