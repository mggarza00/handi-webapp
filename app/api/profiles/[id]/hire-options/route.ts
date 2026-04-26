import { NextResponse } from "next/server";

import { getUserOrThrow } from "@/lib/_supabase-server";
import {
  fetchProfessionalHireProfile,
  getCompatibleHireRequests,
  isClientRole,
} from "@/lib/profiles/hire";
import { getAdminSupabase } from "@/lib/supabase/admin";
import getRouteClient from "@/lib/supabase/route-client";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const profileId = (params?.id || "").trim();
    if (!profileId) {
      return NextResponse.json(
        { ok: false, error: "MISSING_PROFILE_ID" },
        { status: 400, headers: JSONH },
      );
    }

    const routeClient = getRouteClient();
    const { user } = await getUserOrThrow(routeClient);
    const admin = getAdminSupabase();

    const { data: viewerProfile } = await routeClient
      .from("profiles")
      .select("role, is_client_pro")
      .eq("id", user.id)
      .maybeSingle<{
        role: string | null;
        is_client_pro: boolean | null;
      }>();

    if (
      !isClientRole({
        role: viewerProfile?.role ?? null,
        isClientPro: viewerProfile?.is_client_pro ?? false,
      })
    ) {
      return NextResponse.json(
        { ok: false, error: "CLIENT_ROLE_REQUIRED" },
        { status: 403, headers: JSONH },
      );
    }

    const professional = await fetchProfessionalHireProfile(admin, profileId);
    if (!professional) {
      return NextResponse.json(
        { ok: false, error: "PROFESSIONAL_NOT_FOUND" },
        { status: 404, headers: JSONH },
      );
    }

    if (professional.id === user.id || professional.userId === user.id) {
      return NextResponse.json(
        { ok: false, error: "CANNOT_HIRE_SELF" },
        { status: 400, headers: JSONH },
      );
    }

    const compatibleRequests = await getCompatibleHireRequests({
      supabase: admin,
      clientId: user.id,
      professional,
    });

    return NextResponse.json(
      {
        ok: true,
        data: {
          compatibleRequests,
          professional: {
            id: professional.id,
            name: professional.name,
            cities: professional.cities,
            categories: professional.categories,
            subcategories: professional.subcategories,
          },
        },
      },
      { status: 200, headers: JSONH },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: JSONH },
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
