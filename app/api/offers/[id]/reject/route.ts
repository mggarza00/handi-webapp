import { NextResponse } from "next/server";
import { z } from "zod";
import getRouteClient from "@/lib/supabase/route-client";
import { syncOfferAgreementStatus } from "@/lib/agreements/sync-offer-agreement";

import type { Database } from "@/types/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const BodySchema = z.object({
  reason: z.string().max(500).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = getRouteClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user?.id)
      return NextResponse.json(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 401, headers: JSONH },
      );

    const offerId = params.id;
    if (!offerId)
      return NextResponse.json(
        { ok: false, error: "MISSING_OFFER" },
        { status: 400, headers: JSONH },
      );

    const rawBody = await req.text();
    let bodyJson: unknown = {};
    if (rawBody.trim().length) {
      try {
        bodyJson = JSON.parse(rawBody);
      } catch {
        return NextResponse.json(
          { ok: false, error: "INVALID_JSON" },
          { status: 400, headers: JSONH },
        );
      }
    }
    const payload = BodySchema.safeParse(bodyJson);
    if (!payload.success)
      return NextResponse.json(
        {
          ok: false,
          error: "VALIDATION_ERROR",
          detail: payload.error.flatten(),
        },
        { status: 422, headers: JSONH },
      );
    const reason = payload.data.reason?.trim() || null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sel: any = await (supabase as any)
      .from("offers")
      .select("*")
      .eq("id", offerId)
      .single();
    const offer = sel?.data as unknown as {
      professional_id?: string;
      status?: string;
      id?: string;
    } | null;
    const error = sel?.error || null;

    if (error || !offer)
      return NextResponse.json(
        { ok: false, error: "OFFER_NOT_FOUND" },
        { status: 404, headers: JSONH },
      );

    if (offer.professional_id !== auth.user.id)
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN" },
        { status: 403, headers: JSONH },
      );

    const currentStatus = String(offer.status || "").toLowerCase();
    if (!["pending", "sent"].includes(currentStatus))
      return NextResponse.json(
        { ok: false, error: "INVALID_STATUS" },
        { status: 409, headers: JSONH },
      );

    // Use the exact current enum value to avoid casting issues when 'pending' is not part of the enum in some envs
    const currentEnum = (offer as any).status as string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const upd: any = await (supabase as any)
      .from("offers")
      .update({ status: "rejected", reject_reason: reason })
      .eq("id", offer.id)
      .eq("professional_id", auth.user.id)
      .eq("status", currentEnum)
      .select("*")
      .single();

    const upErr = upd?.error || null;
    const updated = upd?.data || null;
    if (upErr || !updated)
      return NextResponse.json(
        { ok: false, error: String(upErr?.message || "OFFER_UPDATE_FAILED") },
        { status: 400, headers: JSONH },
      );

    await syncOfferAgreementStatus({
      offer: updated as Database["public"]["Tables"]["offers"]["Row"],
      status: "rejected",
    });

    return NextResponse.json(
      { ok: true, offer: updated },
      { status: 200, headers: JSONH },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "UNKNOWN";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: JSONH },
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
