import { NextResponse } from "next/server";
import createClient from "@/utils/supabase/server";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export const dynamic = "force-dynamic";

function clearLegacyProApplyCookies(res: NextResponse) {
  for (const name of ["handi_pro_apply", "handee_pro_apply"]) {
    try {
      res.cookies.set(name, "", {
        path: "/",
        sameSite: "lax",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 0,
        expires: new Date(0),
      });
    } catch {
      /* ignore cookie cleanup errors */
    }
  }
}

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

    if (to === "profesional") {
      const [professionalRes, applicationRes] = await Promise.all([
        (supabase as any)
          .from("professionals")
          .select("id, active")
          .eq("id", auth.user.id)
          .maybeSingle(),
        (supabase as any)
          .from("pro_applications")
          .select("status")
          .eq("user_id", auth.user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      const professional = professionalRes.data;
      const lastStatus = (applicationRes.data?.status || "").toLowerCase();
      const isApprovedStatus =
        lastStatus === "accepted" || lastStatus === "approved";
      const canSwitchToPro =
        (Boolean(professional?.id) && professional?.active === true) ||
        isApprovedStatus;
      if (!canSwitchToPro) {
        return NextResponse.json(
          { ok: false, error: "SWITCH_NOT_ALLOWED" },
          { status: 403, headers: JSONH },
        );
      }
    }

    const role = to === "cliente" ? "client" : "pro";
    // Do not mutate profiles.role for active-view switching.
    // Cookie active_role is the active-view source of truth.
    const res = NextResponse.json(
      {
        ok: true,
        data: {
          id: auth.user.id,
          active_role: role,
          role,
        },
      },
      { status: 200, headers: JSONH },
    );
    try {
      res.cookies.set("active_role", role, {
        path: "/",
        sameSite: "lax",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 180,
      });
    } catch {
      /* ignore cookie set errors */
    }
    clearLegacyProApplyCookies(res);
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
