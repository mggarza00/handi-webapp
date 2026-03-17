/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { sendEmail } from "@/lib/email";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ChangePayload = {
  profiles?: Record<string, unknown>;
  professionals?: Record<string, unknown>;
  avatar_draft_path?: string;
  avatar_preview_url?: string;
  gallery_add_paths?: string[];
};

const AVATAR_DRAFT_BUCKET = "profile-change-avatars";
const AVATAR_PUBLIC_BUCKET = "avatars";

const extFromPath = (path: string): string => {
  const raw = (path.split(".").pop() || "jpg").toLowerCase();
  if (["jpg", "jpeg", "png", "webp"].includes(raw)) return raw;
  return "jpg";
};

const mimeFromExt = (ext: string): string => {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
};

export async function POST(_req: Request, ctx: { params: { id: string } }) {
  const adminAuth = await assertAdminOrJson();
  if (!adminAuth.ok) return adminAuth.res;
  const reviewerId = adminAuth.userId;
  const id = ctx.params?.id;
  if (!id)
    return NextResponse.json(
      { ok: false, error: "MISSING_ID" },
      { status: 400, headers: JSONH },
    );
  const admin = getAdminSupabase() as any;

  const { data: req, error } = await admin
    .from("profile_change_requests")
    .select("id, user_id, status, payload")
    .eq("id", id)
    .maybeSingle();
  if (error || !req)
    return NextResponse.json(
      { ok: false, error: "NOT_FOUND" },
      { status: 404, headers: JSONH },
    );
  if ((req as any).status !== "pending") {
    return NextResponse.json(
      { ok: false, error: "INVALID_STATUS" },
      { status: 400, headers: JSONH },
    );
  }

  const payload =
    ((req as unknown as { payload?: unknown })
      ?.payload as ChangePayload | null) ?? null;
  const userId = (req as unknown as { user_id?: string }).user_id as string;
  if (!payload || (!payload.profiles && !payload.professionals)) {
    return NextResponse.json(
      { ok: false, error: "EMPTY_PAYLOAD" },
      { status: 400, headers: JSONH },
    );
  }

  const pick = (
    obj: Record<string, unknown> | undefined | null,
    allow: string[],
  ) => {
    const out: Record<string, unknown> = {};
    if (!obj) return out;
    for (const k of Object.keys(obj)) if (allow.includes(k)) out[k] = obj[k];
    return out;
  };

  const profilesAllow = ["full_name", "avatar_url"];
  const professionalsAllow = [
    "headline",
    "years_experience",
    "city",
    "cities",
    "categories",
    "subcategories",
    "avatar_url",
    "bio",
  ];

  const profPatch = pick(payload.profiles, profilesAllow);
  const proPatch = pick(payload.professionals, professionalsAllow);

  const draftAvatarPath =
    typeof payload.avatar_draft_path === "string" &&
    payload.avatar_draft_path.startsWith(`${userId}/`)
      ? payload.avatar_draft_path
      : null;

  if (draftAvatarPath) {
    const dl = await admin.storage
      .from(AVATAR_DRAFT_BUCKET)
      .download(draftAvatarPath);
    if (dl.error || !dl.data) {
      return NextResponse.json(
        { ok: false, error: "AVATAR_DRAFT_DOWNLOAD_FAILED" },
        { status: 400, headers: JSONH },
      );
    }

    const { data: gotBucket } = await admin.storage
      .getBucket(AVATAR_PUBLIC_BUCKET)
      .catch(() => ({ data: null as null }));
    if (!gotBucket) {
      await admin.storage.createBucket(AVATAR_PUBLIC_BUCKET, {
        public: true,
        fileSizeLimit: "5242880",
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      });
    }

    const ext = extFromPath(draftAvatarPath);
    const targetPath = `${userId}/${Date.now()}-approved.${ext}`;
    const ab = await dl.data.arrayBuffer();
    const up = await admin.storage
      .from(AVATAR_PUBLIC_BUCKET)
      .upload(targetPath, ab, {
        contentType: dl.data.type || mimeFromExt(ext),
        upsert: false,
        cacheControl: "3600",
      });
    if (up.error) {
      return NextResponse.json(
        { ok: false, error: "AVATAR_PUBLISH_FAILED", detail: up.error.message },
        { status: 400, headers: JSONH },
      );
    }

    const publicData = admin.storage
      .from(AVATAR_PUBLIC_BUCKET)
      .getPublicUrl(targetPath).data;
    const publicAvatarUrl = publicData?.publicUrl || "";
    if (!publicAvatarUrl) {
      return NextResponse.json(
        { ok: false, error: "AVATAR_PUBLIC_URL_FAILED" },
        { status: 400, headers: JSONH },
      );
    }

    profPatch.avatar_url = publicAvatarUrl;
    proPatch.avatar_url = publicAvatarUrl;

    // Best effort cleanup of draft once the public avatar is persisted.
    await admin.storage
      .from(AVATAR_DRAFT_BUCKET)
      .remove([draftAvatarPath])
      .catch(() => undefined);
  }
  // Legacy compat: old requests may only carry avatar_url directly in patch payload.

  if (Object.keys(profPatch).length > 0) {
    const { error: up1 } = await (admin as any)
      .from("profiles")
      .update(profPatch as any)
      .eq("id", userId);
    if (up1) {
      return NextResponse.json(
        { ok: false, error: `PROFILE_UPDATE_FAILED: ${up1.message}` },
        { status: 400, headers: JSONH },
      );
    }
  }

  const { data: proExists } = await (admin as any)
    .from("professionals")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (!proExists) {
    const baseInsert: Record<string, unknown> = { id: userId };
    for (const k of Object.keys(proPatch || {}))
      baseInsert[k] = (proPatch as any)[k];
    const { error: ins2 } = await (admin as any)
      .from("professionals")
      .insert(baseInsert as any);
    if (ins2) {
      return NextResponse.json(
        { ok: false, error: `PRO_INSERT_FAILED: ${ins2.message}` },
        { status: 400, headers: JSONH },
      );
    }
  } else if (Object.keys(proPatch).length > 0) {
    const { error: up2 } = await (admin as any)
      .from("professionals")
      .update(proPatch as any)
      .eq("id", userId);
    if (up2) {
      return NextResponse.json(
        { ok: false, error: `PRO_UPDATE_FAILED: ${up2.message}` },
        { status: 400, headers: JSONH },
      );
    }
  }

  try {
    const addPaths = payload.gallery_add_paths;
    if (Array.isArray(addPaths) && addPaths.length) {
      const draftBucket = "profiles-gallery";
      const publicBucket = "professionals-gallery";
      const { data: got } = await admin.storage
        .getBucket(publicBucket)
        .catch(() => ({ data: null }) as any);
      if (!got) {
        await admin.storage.createBucket(publicBucket, {
          public: true,
          fileSizeLimit: "10485760",
          allowedMimeTypes: ["image/*"],
        });
      }
      for (const path of addPaths) {
        if (typeof path !== "string" || !path.startsWith(`${userId}/`))
          continue;
        const dl = await admin.storage.from(draftBucket).download(path);
        if (dl.error || !dl.data) continue;
        const ab = await dl.data.arrayBuffer();
        const name = path.split("/").slice(1).join("/");
        const dest = `${userId}/${name}`;
        const up = await admin.storage.from(publicBucket).upload(dest, ab, {
          contentType: "image/*",
          upsert: true,
        } as any);
        if (up.error) continue;
        await admin.storage
          .from(draftBucket)
          .remove([path])
          .catch(() => undefined);
      }
    }
  } catch {
    // Ignore gallery errors to avoid blocking other approvals.
  }

  const { error: upReq } = await (admin as any)
    .from("profile_change_requests")
    .update({
      status: "approved",
      reviewer_id: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (upReq)
    return NextResponse.json(
      { ok: false, error: "STATUS_UPDATE_FAILED" },
      { status: 400, headers: JSONH },
    );

  try {
    const admin = getAdminSupabase();
    const base =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000";
    let link = `${base}/profiles/${userId}`;
    try {
      const { data: exists } = await (admin as any)
        .from("professionals")
        .select("id")
        .eq("id", userId)
        .maybeSingle();
      if (!exists) link = `${base}/profile/setup`;
    } catch {
      link = `${base}/profile/setup`;
    }
    await (admin as any).from("user_notifications").insert({
      user_id: userId,
      type: "profile_change:approved",
      title: "Cambios de perfil aprobados",
      body: "Tu perfil fue actualizado con los cambios solicitados.",
      link,
    });
    const { data, error: authErr } = await admin.auth.admin.getUserById(userId);
    const to = data?.user?.email || null;
    if (!authErr && to) {
      const subject = "Tus cambios de perfil fueron aprobados";
      const html = `
        <h1>Cambios aprobados</h1>
        <p>Aplicamos los cambios solicitados a tu perfil.</p>
        <p><a href="${link}">Ver tu perfil</a></p>
      `;
      await sendEmail({ to, subject, html });
    }
  } catch {
    // ignore notify errors
  }

  return NextResponse.json({ ok: true }, { status: 200, headers: JSONH });
}
