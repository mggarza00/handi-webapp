import { NextResponse } from "next/server";
import createClient from "@/utils/supabase/server";
import type { Database } from "@/types/supabase";
import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: { id: string } }) {
  const adminAuth = await assertAdminOrJson();
  if (!adminAuth.ok) return adminAuth.res;
  const reviewerId = adminAuth.userId;
  const id = ctx.params?.id;
  if (!id) return NextResponse.json({ ok: false, error: "MISSING_ID" }, { status: 400, headers: JSONH });
  const admin = getAdminSupabase() as any;
  // Fetch the change request
  const { data: req, error } = await admin
    .from("profile_change_requests")
    .select("id, user_id, status, payload")
    .eq("id", id)
    .maybeSingle();
  if (error || !req) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: JSONH });
  if ((req as any).status !== "pending")
    return NextResponse.json({ ok: false, error: "INVALID_STATUS" }, { status: 400, headers: JSONH });

  const payload = (req as unknown as { payload?: unknown })?.payload as
    | { profiles?: Record<string, unknown>; professionals?: Record<string, unknown> }
    | null
    | undefined;
  const userId = (req as unknown as { user_id?: string }).user_id as string;
  if (!payload || (!payload.profiles && !payload.professionals)) {
    return NextResponse.json({ ok: false, error: "EMPTY_PAYLOAD" }, { status: 400, headers: JSONH });
  }

  // Apply changes with whitelist per table (avoid missing columns)
  const pick = (obj: Record<string, unknown> | undefined | null, allow: string[]) => {
    const out: Record<string, unknown> = {};
    if (!obj) return out;
    for (const k of Object.keys(obj)) if (allow.includes(k)) out[k] = obj[k];
    return out;
  };
  const profilesAllow = ["full_name", "avatar_url"]; // city/categorías/subcategorías van en professionals
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
  const profPatch = pick((payload as any).profiles as Record<string, unknown> | undefined, profilesAllow);
  const proPatch = pick((payload as any).professionals as Record<string, unknown> | undefined, professionalsAllow);
  if (Object.keys(profPatch).length > 0) {
    const { error: up1 } = await (admin as any)
      .from("profiles")
      .update(profPatch as any)
      .eq("id", userId);
    if (up1) return NextResponse.json({ ok: false, error: `PROFILE_UPDATE_FAILED: ${up1.message}` }, { status: 400, headers: JSONH });
  }
  // Ensure professionals row exists; insert if missing, else update
  const { data: proExists } = await (admin as any)
    .from("professionals")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (!proExists) {
    const baseInsert: Record<string, unknown> = { id: userId };
    for (const k of Object.keys(proPatch || {})) baseInsert[k] = (proPatch as any)[k];
    const { error: ins2 } = await (admin as any)
      .from("professionals")
      .insert(baseInsert as any);
    if (ins2) return NextResponse.json({ ok: false, error: `PRO_INSERT_FAILED: ${ins2.message}` }, { status: 400, headers: JSONH });
  } else if (Object.keys(proPatch).length > 0) {
    const { error: up2 } = await (admin as any)
      .from("professionals")
      .update(proPatch as any)
      .eq("id", userId);
    if (up2) return NextResponse.json({ ok: false, error: `PRO_UPDATE_FAILED: ${up2.message}` }, { status: 400, headers: JSONH });
  }

  // Handle gallery additions: copy uploaded drafts from 'profiles-gallery' to 'professionals-gallery'
  try {
    const addPaths = (payload as any)?.gallery_add_paths as string[] | undefined;
    if (Array.isArray(addPaths) && addPaths.length) {
      const draftBucket = "profiles-gallery";
      const publicBucket = "professionals-gallery";
      // Ensure destination bucket exists and is public
      const { data: got } = await admin.storage.getBucket(publicBucket).catch(() => ({ data: null }) as any);
      if (!got) {
        await admin.storage.createBucket(publicBucket, {
          public: true,
          fileSizeLimit: "10485760",
          allowedMimeTypes: ["image/*"],
        });
      }
      for (const path of addPaths) {
        if (typeof path !== "string" || !path.startsWith(`${userId}/`)) continue; // enforce prefix
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
        // Best-effort: remove draft after publishing
        await admin.storage.from(draftBucket).remove([path]).catch(() => undefined);
      }
    }
  } catch {
    // Ignore gallery errors to avoid blocking other approvals
  }

  const { error: upReq } = await (admin as any)
    .from("profile_change_requests")
    .update({ status: "approved", reviewer_id: reviewerId, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (upReq) return NextResponse.json({ ok: false, error: "STATUS_UPDATE_FAILED" }, { status: 400, headers: JSONH });
  // Notify user in-app and by email
  try {
    const admin = getAdminSupabase();
    const base =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000";
    // Si no hay registro en professionals, apunta a /profile/setup como fallback
    let link = `${base}/profiles/${userId}`;
    try {
      const { data: exists } = await (admin as any).from("professionals").select("id").eq("id", userId).maybeSingle();
      if (!exists) link = `${base}/profile/setup`;
    } catch {
      link = `${base}/profile/setup`;
    }
    // In-app notification (service role bypasses RLS)
    await (admin as any).from("user_notifications").insert({
      user_id: userId,
      type: "profile_change:approved",
      title: "Cambios de perfil aprobados",
      body: "Tu perfil fue actualizado con los cambios solicitados.",
      link,
    });
    // Email notification
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
