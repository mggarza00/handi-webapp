import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import createClient from "@/utils/supabase/server";
import { resolveActiveView } from "@/lib/routing/active-view";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user)
      return NextResponse.json(
        { ok: false, error: "UNAUTHENTICATED" },
        { status: 401, headers: JSONH },
      );

    const uid = auth.user.id;
    const activeRoleCookie = cookies().get("active_role")?.value ?? null;
    const [profileRes, professionalRes, applicationRes] = await Promise.all([
      (supabase as any)
        .from("profiles")
        .select("role, is_client_pro")
        .eq("id", uid)
        .maybeSingle(),
      (supabase as any)
        .from("professionals")
        .select("id, active")
        .eq("id", uid)
        .maybeSingle(),
      (supabase as any)
        .from("pro_applications")
        .select("status")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const profile = profileRes.data;
    const hasActiveProfessional =
      Boolean(professionalRes.data?.id) &&
      professionalRes.data?.active === true;
    const lastStatus = (applicationRes.data?.status || "").toLowerCase();
    const isApprovedStatus =
      lastStatus === "accepted" || lastStatus === "approved";

    const canSwitch = hasActiveProfessional || isApprovedStatus;
    const currentRole = resolveActiveView({
      activeRoleCookie,
      profileRole: (profile?.role ?? null) as string | null,
      isClientPro:
        (profile as { is_client_pro?: boolean | null } | null)
          ?.is_client_pro === true,
      professionalIsActive: hasActiveProfessional,
    });
    const other = currentRole === "pro" ? "cliente" : ("profesional" as const);
    return NextResponse.json(
      { ok: true, canSwitch, other },
      { headers: JSONH },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", detail: msg },
      { status: 500, headers: JSONH },
    );
  }
}

export function POST() {
  return NextResponse.json(
    { ok: false, error: "METHOD_NOT_ALLOWED" },
    { status: 405, headers: JSONH },
  );
}
