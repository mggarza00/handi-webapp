import { NextResponse } from "next/server";
import createClient from "@/utils/supabase/server";
import type { Database } from "@/types/supabase";
import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const adminAuth = await assertAdminOrJson();
  if (!adminAuth.ok) return adminAuth.res;
  const reviewerId = adminAuth.userId;
  const id = ctx.params?.id;
  if (!id) return NextResponse.json({ ok: false, error: "MISSING_ID" }, { status: 400, headers: JSONH });

  let notes: string | null = null;
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("application/json")) {
      const body = (await req.json().catch(() => null)) as { review_notes?: string; reason?: string } | null;
      notes = (body?.review_notes || body?.reason || "").trim() || null;
    } else if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
      const fd = await req.formData();
      notes = ((fd.get("review_notes") as string | null) || (fd.get("reason") as string | null) || "").trim() || null;
    }
  } catch {
    // ignore
  }

  const admin = getAdminSupabase() as any;
  const { error } = await (admin as any)
    .from("profile_change_requests")
    .update({ status: "rejected", reviewer_id: reviewerId, reviewed_at: new Date().toISOString(), review_notes: notes ?? undefined })
    .eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: "STATUS_UPDATE_FAILED" }, { status: 400, headers: JSONH });
  // Notify user in-app and by email
  try {
    // Fetch user_id to notify
    const { data: reqRow } = await (admin as any)
      .from("profile_change_requests")
      .select("user_id")
      .eq("id", id)
      .single();
    const uid = (reqRow as unknown as { user_id?: string } | null)?.user_id;
    if (uid) {
      const base =
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        "http://localhost:3000";
      const link = `${base}/profile/setup`;
      // In-app notification
      await (admin as any).from("user_notifications").insert({
        user_id: uid,
        type: "profile_change:rejected",
        title: "Cambios de perfil rechazados",
        body: notes ? `Motivo: ${notes}` : "Revisa tu información y vuelve a intentar.",
        link,
      });
      // Email notification
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
