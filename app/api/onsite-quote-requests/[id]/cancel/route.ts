import { NextResponse } from "next/server";

import {
  getDevUserFromHeader,
  getUserFromRequestOrThrow,
} from "@/lib/auth-route";
import { createServerClient } from "@/lib/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const CANCELLABLE_STATUSES = [
  "requested",
  "scheduled",
  "accepted",
  "deposit_pending",
] as const;

function normalizeStatus(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    let user = (await getDevUserFromHeader(req))?.user ?? null;
    if (!user) ({ user } = await getUserFromRequestOrThrow(req));
    const admin = createServerClient();
    const id = (params?.id || "").trim();
    if (!id) {
      return NextResponse.json(
        { ok: false, error: "MISSING_ID" },
        { status: 400, headers: JSONH },
      );
    }

    const { data: row } = await admin
      .from("onsite_quote_requests")
      .select("id, conversation_id, professional_id, status")
      .eq("id", id)
      .maybeSingle();
    if (!row) {
      return NextResponse.json(
        { ok: false, error: "NOT_FOUND" },
        { status: 404, headers: JSONH },
      );
    }
    if (
      String(
        (row as { professional_id?: string | null }).professional_id || "",
      ) !== user.id
    ) {
      return NextResponse.json(
        { ok: false, error: "ONLY_PRO" },
        { status: 403, headers: JSONH },
      );
    }

    const currentStatus = normalizeStatus(
      (row as { status?: string | null }).status,
    );
    if (
      !CANCELLABLE_STATUSES.includes(
        currentStatus as (typeof CANCELLABLE_STATUSES)[number],
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "INVALID_STATUS",
          detail: `Cannot cancel onsite quote request in status ${currentStatus || "unknown"}.`,
        },
        { status: 409, headers: JSONH },
      );
    }

    const { error } = await admin
      .from("onsite_quote_requests")
      .update({
        status: "canceled",
        deposit_checkout_url: null,
      })
      .eq("id", id)
      .in("status", [...CANCELLABLE_STATUSES]);
    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: "ONSITE_CANCEL_FAILED",
          detail: error.message,
          code: error.code || null,
        },
        { status: 500, headers: JSONH },
      );
    }

    return NextResponse.json(
      { ok: true, id, status: "canceled" },
      { status: 200, headers: JSONH },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 400, headers: JSONH },
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
