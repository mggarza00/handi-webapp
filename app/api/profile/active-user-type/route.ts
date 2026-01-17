import { NextResponse } from "next/server";
import createClient from "@/utils/supabase/server";

import type { Database } from "@/types/supabase";

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
      const [profileRes, professionalRes, applicationRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("is_client_pro")
          .eq("id", userId)
          .maybeSingle<{ is_client_pro: boolean | null }>(),
        supabase
          .from("professionals")
          .select("id")
          .eq("id", userId)
          .maybeSingle<{ id: string }>(),
        supabase
          .from("pro_applications")
          .select("status")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle<{ status: string | null }>(),
      ]);

      const isClientPro = profileRes.data?.is_client_pro === true;
      const hasProfessionalRow = Boolean(professionalRes.data?.id);
      const lastStatus = (applicationRes.data?.status || "").toLowerCase();
      const isApprovedStatus =
        lastStatus === "accepted" || lastStatus === "approved";

      if (!isClientPro && !hasProfessionalRow && !isApprovedStatus) {
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

    // Map Spanish to existing DB role enum
    const role = to === "cliente" ? "client" : "pro";
    const { data, error } = await (supabase as any)
      .from("profiles")
      .update({ role } as Database["public"]["Tables"]["profiles"]["Update"])
      .eq("id", userId)
      .select("id, role")
      .single();
    if (error) {
      const status = /permission|rls/i.test(error.message) ? 403 : 400;
      return NextResponse.json(
        { ok: false, error: "UPDATE_FAILED", detail: error.message },
        { status, headers: JSONH },
      );
    }
    return NextResponse.json({ ok: true, data }, { status: 200, headers: JSONH });
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
