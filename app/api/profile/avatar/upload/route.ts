import { NextResponse } from "next/server";

import { getAdminSupabase } from "@/lib/supabase/admin";
import createClient from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;
const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

const sanitizeBaseName = (value: string): string =>
  value
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "avatar";

export async function POST(req: Request) {
  try {
    const supa = createClient();
    const {
      data: { user },
    } = await supa.auth.getUser();
    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          error: "UNAUTHENTICATED",
          detail: "Debes iniciar sesión.",
        },
        { status: 401, headers: JSONH },
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "BAD_REQUEST", detail: "Archivo faltante." },
        { status: 400, headers: JSONH },
      );
    }

    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        {
          ok: false,
          error: "UNSUPPORTED_FORMAT",
          detail: "Formato no soportado. Solo se permite JPG, PNG o WEBP.",
        },
        { status: 400, headers: JSONH },
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { ok: false, error: "TOO_LARGE", detail: "El archivo excede 5MB." },
        { status: 400, headers: JSONH },
      );
    }

    const admin = getAdminSupabase();

    const bucket = "avatars";
    const { data: got } = await admin.storage
      .getBucket(bucket)
      .catch(() => ({ data: null as null }));
    if (!got) {
      await admin.storage.createBucket(bucket, {
        public: true,
        fileSizeLimit: String(MAX_SIZE),
        allowedMimeTypes: Array.from(ALLOWED_MIME.keys()),
      });
    }

    const ext = ALLOWED_MIME.get(file.type) ?? "jpg";
    const safeName = sanitizeBaseName(file.name || "avatar");
    const stamp = Date.now();
    const path = `${user.id}/${stamp}-${safeName}.${ext}`;

    const ab = await file.arrayBuffer();
    const buf = Buffer.from(ab);
    const up = await admin.storage.from(bucket).upload(path, buf, {
      contentType: file.type,
      upsert: false,
      cacheControl: "3600",
    });
    if (up.error) {
      return NextResponse.json(
        { ok: false, error: "UPLOAD_FAILED", detail: up.error.message },
        { status: 500, headers: JSONH },
      );
    }

    const pub = admin.storage.from(bucket).getPublicUrl(path).data;
    const url = pub?.publicUrl || "";
    if (!url) {
      return NextResponse.json(
        {
          ok: false,
          error: "NO_URL",
          detail: "No se pudo generar la URL pública.",
        },
        { status: 500, headers: JSONH },
      );
    }

    // Do NOT persist in DB here. The setup page must request changes for admin approval.
    // Return the URL so the client can include it in the change request payload.
    return NextResponse.json({ ok: true, url }, { headers: JSONH });
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
