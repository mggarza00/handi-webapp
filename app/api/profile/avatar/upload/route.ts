import { NextResponse } from "next/server";
import createClient from "@/utils/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

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

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) {
      return NextResponse.json(
        { ok: false, error: "BAD_REQUEST", detail: "file missing" },
        { status: 400, headers: JSONH },
      );
    }
    const size = (file as any).size as number;
    const type = (file as any).type as string | undefined;
    const name = (file as any).name as string | undefined;
    if (!type || !/^image\//i.test(type)) {
      return NextResponse.json(
        { ok: false, error: "UNSUPPORTED", detail: "invalid content-type" },
        { status: 400, headers: JSONH },
      );
    }
    const MAX = 5 * 1024 * 1024;
    if (size > MAX) {
      return NextResponse.json(
        { ok: false, error: "TOO_LARGE", detail: "max 5MB" },
        { status: 400, headers: JSONH },
      );
    }

    const admin = getAdminSupabase();

    // Ensure bucket exists (public read)
    const bucket = "avatars";
    const { data: got } = await admin.storage.getBucket(bucket).catch(() => ({ data: null } as any));
    if (!got) {
      await admin.storage.createBucket(bucket, {
        public: true,
        fileSizeLimit: String(MAX),
        allowedMimeTypes: ["image/*"],
      });
    }

    const ext = (name?.split(".").pop() || "jpg").toLowerCase();
    const path = `${user.id}.${ext}`;

    const ab = await file.arrayBuffer();
    // eslint-disable-next-line no-undef
    const buf = Buffer.from(ab);
    const up = await admin.storage.from(bucket).upload(path, buf, {
      contentType: type,
      upsert: true,
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
        { ok: false, error: "NO_URL" },
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
