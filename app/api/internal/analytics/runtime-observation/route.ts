import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { JSONH } from "@/lib/auth-admin";
import { recordInstrumentationObservation } from "@/lib/analytics/runtime-health";
import {
  analyticsEventNameSchema,
  analyticsProviderTargetSchema,
  instrumentationDispatchStatusSchema,
} from "@/lib/analytics/schemas";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const observationPayloadSchema = z.object({
  observations: z.array(
    z.object({
      event_name: analyticsEventNameSchema,
      provider_target: analyticsProviderTargetSchema,
      dispatch_status: instrumentationDispatchStatusSchema,
      route_path: z.string().trim().min(1).nullable().optional(),
      surface_id: z.string().trim().min(1).nullable().optional(),
    }),
  ),
});

function isSameOriginRequest(req: Request) {
  const headerStore = headers();
  const host =
    headerStore.get("x-forwarded-host") || headerStore.get("host") || "";
  const requestHost = host.split(":")[0].trim().toLowerCase();

  const candidates = [
    req.headers.get("origin"),
    req.headers.get("referer"),
  ].filter((value): value is string => Boolean(value));

  if (!requestHost) return true;
  if (!candidates.length) return true;

  return candidates.some((candidate) => {
    try {
      return new URL(candidate).hostname.toLowerCase() === requestHost;
    } catch {
      return false;
    }
  });
}

export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json(
      { ok: false, error: "forbidden" },
      { status: 403, headers: JSONH },
    );
  }

  try {
    const body = await req.json();
    const parsed = observationPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "invalid_payload" },
        { status: 422, headers: JSONH },
      );
    }

    const admin = getAdminSupabase();
    await Promise.all(
      parsed.data.observations.map((observation) =>
        recordInstrumentationObservation(admin, {
          eventName: observation.event_name,
          eventSource: "browser",
          providerTarget: observation.provider_target,
          dispatchStatus: observation.dispatch_status,
          routePath: observation.route_path || null,
          surfaceId: observation.surface_id || null,
        }),
      ),
    );

    return NextResponse.json({ ok: true }, { headers: JSONH });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "runtime_observation_failed";
    return NextResponse.json(
      { ok: false, error: "internal_error", detail },
      { status: 500, headers: JSONH },
    );
  }
}
