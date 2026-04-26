import { NextResponse } from "next/server";
import { z } from "zod";

import { getUserOrThrow } from "@/lib/_supabase-server";
import { getOrCreateConversation } from "@/lib/chat";
import {
  fetchProfessionalHireProfile,
  isClientRole,
  isOpenRequestStatus,
  isRequestCompatibleWithProfessional,
  toCompatibleRequestSummary,
} from "@/lib/profiles/hire";
import { getAdminSupabase } from "@/lib/supabase/admin";
import getRouteClient from "@/lib/supabase/route-client";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const BodySchema = z.object({
  requestId: z.string().uuid(),
});

export async function POST(
  req: Request,
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
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "VALIDATION_ERROR",
          detail: parsed.error.flatten(),
        },
        { status: 422, headers: JSONH },
      );
    }

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

    const admin = getAdminSupabase();
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

    const requestLookup = await admin
      .from("requests")
      .select(
        "id, title, city, category, subcategory, subcategories, status, created_at, created_by",
      )
      .eq("id", parsed.data.requestId)
      .maybeSingle();

    if (requestLookup.error || !requestLookup.data) {
      return NextResponse.json(
        { ok: false, error: "REQUEST_NOT_FOUND" },
        { status: 404, headers: JSONH },
      );
    }

    const requestRow = requestLookup.data as Record<string, unknown>;
    if (String(requestRow.created_by ?? "") !== user.id) {
      return NextResponse.json(
        { ok: false, error: "REQUEST_NOT_OWNED" },
        { status: 403, headers: JSONH },
      );
    }

    if (!isOpenRequestStatus(requestRow.status)) {
      return NextResponse.json(
        { ok: false, error: "REQUEST_NOT_OPEN" },
        { status: 400, headers: JSONH },
      );
    }

    if (
      !isRequestCompatibleWithProfessional({
        request: requestRow,
        professional,
      })
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "REQUEST_NOT_COMPATIBLE",
          data: {
            request: toCompatibleRequestSummary(requestRow),
            professional: {
              id: professional.id,
              name: professional.name,
              cities: professional.cities,
              categories: professional.categories,
              subcategories: professional.subcategories,
            },
          },
        },
        { status: 400, headers: JSONH },
      );
    }

    const conversation = await getOrCreateConversation(
      parsed.data.requestId,
      professional.id,
      user.id,
    );

    return NextResponse.json(
      {
        ok: true,
        data: {
          conversationId: conversation.id,
          redirectUrl: `/mensajes/${encodeURIComponent(conversation.id)}`,
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
