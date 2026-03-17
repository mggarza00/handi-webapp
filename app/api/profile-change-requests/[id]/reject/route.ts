/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { sendEmail } from "@/lib/email";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type RejectPayload = {
  avatar_draft_path?: string;
};

const AVATAR_DRAFT_BUCKET = "profile-change-avatars";

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const adminAuth = await assertAdminOrJson();
  if (!adminAuth.ok) return adminAuth.res;
  const reviewerId = adminAuth.userId;
  const id = ctx.params?.id;
  if (!id)
    return NextResponse.json(
      { ok: false, error: "MISSING_ID" },
      { status: 400, headers: JSONH },
    );

  let notes: string | null = null;
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("application/json")) {
      const body = (await req.json().catch(() => null)) as {
        review_notes?: string;
        reason?: string;
      } | null;
      notes = (body?.review_notes || body?.reason || "").trim() || null;
    } else if (
      ct.includes("application/x-www-form-urlencoded") ||
      ct.includes("multipart/form-data")
    ) {
      const fd = await req.formData();
      notes =
        (
          (fd.get("review_notes") as string | null) ||
          (fd.get("reason") as string | null) ||
          ""
        ).trim() || null;
    }
  } catch {
    // ignore
  }

  const admin = getAdminSupabase() as any;

  const { data: reqRow } = await (admin as any)
    .from("profile_change_requests")
    .select("user_id, payload")
    .eq("id", id)
    .maybeSingle();
  const uid = (reqRow as { user_id?: string } | null)?.user_id || null;
  const payload =
    (reqRow as { payload?: RejectPayload } | null)?.payload || null;

  // Best-effort cleanup for draft avatar on rejection.
  const avatarDraftPath =
    typeof payload?.avatar_draft_path === "string" && uid
      ? payload.avatar_draft_path
      : null;
  if (avatarDraftPath && avatarDraftPath.startsWith(`${uid}/`)) {
    await admin.storage
      .from(AVATAR_DRAFT_BUCKET)
      .remove([avatarDraftPath])
      .catch(() => undefined);
  }

  const { error } = await (admin as any)
    .from("profile_change_requests")
    .update({
      status: "rejected",
      reviewer_id: reviewerId,
      reviewed_at: new Date().toISOString(),
      review_notes: notes ?? undefined,
    })
    .eq("id", id);
  if (error)
    return NextResponse.json(
      { ok: false, error: "STATUS_UPDATE_FAILED" },
      { status: 400, headers: JSONH },
    );

  try {
    if (uid) {
      const base =
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        "http://localhost:3000";
      const link = `${base}/profile/setup`;
      await (admin as any).from("user_notifications").insert({
        user_id: uid,
        type: "profile_change:rejected",
        title: "Cambios de perfil rechazados",
        body: notes
          ? `Motivo: ${notes}`
          : "Revisa tu información y vuelve a intentar.",
        link,
      });
      const { data, error: authErr } = await admin.auth.admin.getUserById(uid);
      const to = data?.user?.email || null;
      if (!authErr && to) {
        const subject = "Tus cambios de perfil fueron rechazados";
        const html = `
          <h1>Cambios rechazados</h1>
          <p>No pudimos aprobar los cambios a tu perfil.${notes ? ` Motivo: ${notes}` : ""}</p>
          <p><a href="${link}">Revisar mi perfil</a></p>
        `;
        await sendEmail({ to, subject, html });
      }
    }
  } catch {
    // ignore notify errors
  }

  return NextResponse.json({ ok: true }, { status: 200, headers: JSONH });
}
