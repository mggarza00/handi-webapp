import { NextResponse } from "next/server";

import { getAdminSupabase } from "@/lib/supabase/admin";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const bucket = (url.searchParams.get("b") || "requests").trim();
    const admin = getAdminSupabase();

    // Verifica existencia
    const { data: got } = await admin.storage
      .getBucket(bucket)
      .catch(() => ({ data: null }) as { data: null });
    if (!got) {
      const { error: createErr } = await admin.storage.createBucket(bucket, {
        public: true,
        fileSizeLimit: "5242880", // 5MB
        allowedMimeTypes: [
          "image/*",
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
      });
      if (createErr) {
        return NextResponse.json(
          { ok: false, error: "create_failed", detail: createErr.message },
          { status: 400, headers: JSONH },
        );
      }
    }

    return NextResponse.json({ ok: true, bucket }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json(
      { ok: false, error: "internal", detail: msg },
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
