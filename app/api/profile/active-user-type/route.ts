import { NextResponse } from "next/server";
import createClient from "@/utils/supabase/server";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json"))
      return NextResponse.json(
        { ok: false, error: "UNSUPPORTED_MEDIA_TYPE" },
        { status: 415, headers: JSONH },
      );
    const body = (await req.json().catch(() => null)) as { to?: string } | null;
    const to = (body?.to || "").toString();
    if (to !== "cliente" && to !== "profesional")
      return NextResponse.json(
        { ok: false, error: "INVALID_TO" },
        { status: 400, headers: JSONH },
      );

    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user)
      return NextResponse.json(
        { ok: false, error: "UNAUTHENTICATED" },
        { status: 401, headers: JSONH },
      );

    const userId = auth.user.id;

    if (to === "profesional") {
      const [professionalRes, applicationRes] = await Promise.all([
        supabase
          .from("professionals")
          .select("id, active")
          .eq("id", userId)
          .maybeSingle<{ id: string; active: boolean | null }>(),
        supabase
          .from("pro_applications")
          .select("status")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle<{ status: string | null }>(),
      ]);

      const hasActiveProfessional =
        Boolean(professionalRes.data?.id) &&
        professionalRes.data?.active === true;
      const lastStatus = (applicationRes.data?.status || "").toLowerCase();
      const isApprovedStatus =
        lastStatus === "accepted" || lastStatus === "approved";

      if (!hasActiveProfessional && !isApprovedStatus) {
        return NextResponse.json(
          {
            ok: false,
            error: "PRO_NOT_APPROVED",
            detail:
              "Tu cuenta aun no ha sido aprobada como profesional. Completa la postulacion en /pro-apply.",
          },
          { status: 403, headers: JSONH },
        );
      }
    }

    const activeRole = to === "cliente" ? "client" : "pro";
    // Keep profiles.role as canonical capability, not as ephemeral active-view toggle.
    // For onboarding compatibility, only backfill role when it is currently missing.
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", userId)
      .maybeSingle<{ id: string; role: string | null }>();
    let profileRole = (profile?.role || "").toString().trim().toLowerCase();

    if (!profileRole) {
      const canonicalRole = activeRole;
      const { error: updateError } = await (supabase as any)
        .from("profiles")
        .update({ role: canonicalRole })
        .eq("id", userId);
      if (updateError) {
        const status = /permission|rls/i.test(updateError.message) ? 403 : 400;
        return NextResponse.json(
          { ok: false, error: "UPDATE_FAILED", detail: updateError.message },
          { status, headers: JSONH },
        );
      }
      profileRole = canonicalRole;
    }

    const res = NextResponse.json(
      {
        ok: true,
        data: {
          id: userId,
          active_role: activeRole,
          role: activeRole,
          profile_role: profileRole || null,
        },
      },
      { status: 200, headers: JSONH },
    );
    try {
      res.cookies.set("active_role", activeRole, {
        path: "/",
        sameSite: "lax",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 180,
      });
    } catch {
      /* ignore cookie set errors */
    }
    return res;
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
