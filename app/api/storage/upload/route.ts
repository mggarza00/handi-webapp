import { NextResponse } from "next/server";

import { getAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const path = String(form.get("path") || "");
    const bucket = String(form.get("bucket") || "requests");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "file_required" },
        { status: 400, headers: JSONH },
      );
    }
    if (!path) {
      return NextResponse.json(
        { ok: false, error: "path_required" },
        { status: 400, headers: JSONH },
      );
    }
    const admin = getAdminSupabase();

    // Ensure bucket exists (idempotent) - explicitly check result and create if missing
    const { data: existingBucket } = await admin.storage
      .getBucket(bucket)
      .catch(() => ({ data: null } as { data: null }));
    if (!existingBucket) {
      const isProVerifications = bucket === "pro-verifications";
      const { error: createErr } = await admin.storage.createBucket(bucket, {
        public: true,
        fileSizeLimit: isProVerifications ? "10485760" : "5242880",
        allowedMimeTypes: isProVerifications
          ? [
              "image/*",
              "application/pdf",
              "application/msword",
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ]
          : ["image/*"],
      });
      if (createErr) {
        return NextResponse.json(
          { ok: false, error: "create_bucket_failed", detail: createErr.message },
          { status: 400, headers: JSONH },
        );
      }
    }

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const { error } = await admin.storage
      .from(bucket)
      .upload(path, bytes, { contentType: file.type, upsert: false });
    if (error)
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400, headers: JSONH },
      );
    const pub = admin.storage.from(bucket).getPublicUrl(path);
    return NextResponse.json(
      {
        ok: true,
        url: pub.data.publicUrl,
        path,
        mime: file.type,
        size: file.size,
      },
      { headers: JSONH },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json(
      { ok: false, error: msg },
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
