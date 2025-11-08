import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createSupabaseJs } from "@supabase/supabase-js";
import createClient from "@/utils/supabase/server";

import type { Database } from "@/types/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

type CtxP = { params: { id: string } };
const IdSchema = z.string().uuid();

export async function GET(_req: Request, { params }: CtxP) {
  const { id } = params;
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

  const admin = createSupabaseJs<Database>(url, serviceRole);
  const prefix = `${parsed.data}/`;
  const { data, error } = await admin.storage
    .from("profiles-gallery")
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
          .from("profiles-gallery")
          .createSignedUrl(path, 60 * 60) // 1 hora
          .catch(() => ({ data: null, error: null }));
        let url = signed?.data?.signedUrl || null;
        if (!url) {
          const pub = admin.storage.from("profiles-gallery").getPublicUrl(path);
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

  return NextResponse.json({ ok: true, data: items }, { status: 200, headers: JSONH });
}

export async function POST(req: Request, { params }: CtxP) {
  const { id } = params;
  const parsed = IdSchema.safeParse(id);
  if (!parsed.success)
    return NextResponse.json(
      { ok: false, error: "INVALID_ID" },
      { status: 400, headers: JSONH },
    );

  // Auth: only the owner can upload under their folder
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id ?? null;
  if (!uid || uid !== parsed.data)
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401, headers: JSONH },
    );

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
  if (!url || !serviceRole)
    return NextResponse.json(
      { ok: false, error: "SERVER_MISCONFIGURED" },
      { status: 500, headers: JSONH },
    );

  const admin = createSupabaseJs<Database>(url, serviceRole);

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob))
      return NextResponse.json(
        { ok: false, error: "MISSING_FILE" },
        { status: 400, headers: JSONH },
      );
    const size = (file as any).size as number;
    const type = (file as any).type as string | undefined;
    const name = ((file as any).name as string | undefined) || "upload.jpg";
    if (!type || !/^image\//i.test(type))
      return NextResponse.json(
        { ok: false, error: "UNSUPPORTED", detail: "Invalid content-type" },
        { status: 400, headers: JSONH },
      );
    const MAX = 5 * 1024 * 1024;
    if (size > MAX)
      return NextResponse.json(
        { ok: false, error: "TOO_LARGE", detail: "Max 5MB" },
        { status: 400, headers: JSONH },
      );

    // Ensure bucket exists
    const bucket = "profiles-gallery";
    const { data: got } = await admin.storage.getBucket(bucket).catch(() => ({ data: null }) as any);
    if (!got) {
      const { error: bErr } = await admin.storage.createBucket(bucket, {
        public: true,
        fileSizeLimit: String(MAX),
        allowedMimeTypes: ["image/*"],
      });
      if (bErr)
        return NextResponse.json(
          { ok: false, error: "BUCKET_CREATE_FAILED", detail: bErr.message },
          { status: 500, headers: JSONH },
        );
    }

    const safeName = name.replace(/[\\/]+/g, "-");
    const path = `${parsed.data}/${Date.now()}-${encodeURIComponent(safeName)}`;
    const ab = await file.arrayBuffer();
    // eslint-disable-next-line no-undef
    const buf = Buffer.from(ab);
    const up = await admin.storage.from(bucket).upload(path, buf, { contentType: type, upsert: false });
    if (up.error)
      return NextResponse.json(
        { ok: false, error: "UPLOAD_FAILED", detail: up.error.message },
        { status: 500, headers: JSONH },
      );

    const signed = await admin.storage.from(bucket).createSignedUrl(path, 60 * 60).catch(() => ({ data: null, error: null }));
    const pub = admin.storage.from(bucket).getPublicUrl(path);
    const item = {
      path,
      name: safeName,
      size,
      url: signed?.data?.signedUrl || pub.data.publicUrl,
    } as const;
    return NextResponse.json({ ok: true, item }, { status: 201, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", detail: msg },
      { status: 500, headers: JSONH },
    );
  }
}

export async function DELETE(req: Request, { params }: CtxP) {
  const { id } = params;
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

  const supabase = createClient();
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
  const admin = createSupabaseJs<Database>(url, serviceRole);
  const { error } = await admin.storage.from("profiles-gallery").remove([path]);
  if (error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 400, headers: JSONH },
    );
  return NextResponse.json({ ok: true }, { status: 200, headers: JSONH });
}
