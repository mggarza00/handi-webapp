/* eslint-disable @typescript-eslint/no-explicit-any */
import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAdminSupabase } from "@/lib/supabase/admin";
import createClient from "@/utils/supabase/server";

const Body = z.object({
  requestId: z.string().uuid(),
  reviewerRole: z.enum(["client", "pro"]),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1).max(400).optional(),
  professionalId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  photos: z
    .array(
      z.object({
        path: z.string().min(3),
        thumb_path: z.string().min(3).optional(),
        size_bytes: z.number().int().nonnegative().optional(),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
      }),
    )
    .optional(),
});

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

async function hasAgreementLink(
  admin: any,
  requestId: string,
  professionalId: string,
) {
  const { data } = await admin
    .from("agreements")
    .select("id")
    .eq("request_id", requestId)
    .eq("professional_id", professionalId)
    .in("status", ["accepted", "paid", "in_progress", "completed"])
    .limit(1);

  return Array.isArray(data) && data.length > 0;
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => ({}));
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400, headers: JSONH },
      );
    }

    const {
      requestId,
      reviewerRole,
      rating,
      comment,
      professionalId,
      clientId,
      photos,
    } = parsed.data;

    const userClient = createClient();
    const { data: auth } = await userClient.auth.getUser();
    const me = auth?.user?.id ?? null;
    if (!me) {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401, headers: JSONH },
      );
    }

    const admin = getAdminSupabase() as any;
    const { data: reqRow } = await admin
      .from("requests")
      .select(
        "id, created_by, title, status, professional_id, accepted_professional_id, scheduled_date, scheduled_time, finalized_by_pro_at, finalized_by_client_at",
      )
      .eq("id", requestId)
      .maybeSingle();

    const ownerId = (reqRow as any)?.created_by as string | undefined;
    if (!ownerId) {
      return NextResponse.json(
        { error: "REQUEST_NOT_FOUND" },
        { status: 404, headers: JSONH },
      );
    }

    const requestTitle =
      typeof (reqRow as any)?.title === "string"
        ? ((reqRow as any).title as string)
        : "Servicio";
    const requestStatus = String((reqRow as any)?.status ?? "").toLowerCase();
    const assignedProId =
      ((reqRow as any)?.accepted_professional_id as string | undefined) ||
      ((reqRow as any)?.professional_id as string | undefined) ||
      null;

    let toUserId: string | null = null;
    let reviewProId: string | null = null;

    if (reviewerRole === "client") {
      toUserId = professionalId ?? assignedProId ?? null;
      reviewProId = toUserId;
      if (me !== ownerId) {
        return NextResponse.json(
          { error: "FORBIDDEN" },
          { status: 403, headers: JSONH },
        );
      }
      if (!toUserId) {
        return NextResponse.json(
          { error: "MISSING_COUNTERPART" },
          { status: 400, headers: JSONH },
        );
      }
      const linked =
        assignedProId === toUserId ||
        (await hasAgreementLink(admin, requestId, toUserId));
      if (!linked) {
        return NextResponse.json(
          { error: "PROFESSIONAL_NOT_IN_REQUEST" },
          { status: 403, headers: JSONH },
        );
      }
      if (
        !(
          Boolean((reqRow as any)?.finalized_by_pro_at) ||
          requestStatus === "finished"
        )
      ) {
        return NextResponse.json(
          { error: "PROFESSIONAL_NOT_FINISHED" },
          { status: 409, headers: JSONH },
        );
      }
    } else {
      toUserId = clientId ?? ownerId;
      reviewProId = me;
      const linked =
        assignedProId === me || (await hasAgreementLink(admin, requestId, me));
      if (!linked) {
        return NextResponse.json(
          { error: "FORBIDDEN" },
          { status: 403, headers: JSONH },
        );
      }
      if (!(requestStatus === "in_process" || requestStatus === "finished")) {
        return NextResponse.json(
          { error: "REQUEST_NOT_READY_FOR_REVIEW" },
          { status: 409, headers: JSONH },
        );
      }
    }

    const { data: exists } = await admin
      .from("ratings")
      .select("id")
      .eq("request_id", requestId)
      .eq("from_user_id", me)
      .limit(1);
    if (Array.isArray(exists) && exists.length) {
      return NextResponse.json(
        { error: "DUPLICATE_REVIEW" },
        { status: 409, headers: JSONH },
      );
    }

    const insertResult = await (userClient as any).from("ratings").insert({
      request_id: requestId,
      from_user_id: me,
      to_user_id: toUserId,
      stars: rating,
      comment: comment ?? null,
    });
    if (insertResult.error) {
      const message = insertResult.error.message || "INSERT_FAILED";
      const status = /row-level security|permission/i.test(message) ? 403 : 400;
      return NextResponse.json({ error: message }, { status, headers: JSONH });
    }

    let insertedRatingId: string | null = null;
    const { data: insertedRating } = await admin
      .from("ratings")
      .select("id")
      .eq("request_id", requestId)
      .eq("from_user_id", me)
      .eq("to_user_id", toUserId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>();
    insertedRatingId = insertedRating?.id ?? null;

    if (Array.isArray(photos) && photos.length) {
      const rows = photos.map((p) => ({
        request_id: requestId,
        path: p.path,
        thumb_path: p.thumb_path ?? null,
        size_bytes: p.size_bytes ?? null,
        width: p.width ?? null,
        height: p.height ?? null,
        created_by: me,
      }));
      await admin.from("request_photos").insert(rows as any);
    }

    try {
      if (reviewerRole === "pro" && !(reqRow as any)?.finalized_by_pro_at) {
        await admin
          .from("requests")
          .update({ finalized_by_pro_at: new Date().toISOString() } as any)
          .eq("id", requestId)
          .is("finalized_by_pro_at", null);
      }
      if (
        reviewerRole === "client" &&
        !(reqRow as any)?.finalized_by_client_at
      ) {
        await admin
          .from("requests")
          .update({ finalized_by_client_at: new Date().toISOString() } as any)
          .eq("id", requestId)
          .is("finalized_by_client_at", null);
      }

      const { data: conv } = await admin
        .from("conversations")
        .select("id, pro_id")
        .eq("request_id", requestId)
        .order("last_message_at", { ascending: false })
        .maybeSingle();
      const convId = (conv as any)?.id as string | undefined;
      const proUserId =
        reviewProId ||
        ((conv as any)?.pro_id as string | undefined) ||
        assignedProId ||
        undefined;
      const requestScheduledDate =
        ((reqRow as any)?.scheduled_date as string | undefined) || null;
      const requestScheduledTime =
        ((reqRow as any)?.scheduled_time as string | undefined) || null;
      const { data: requestAfter } = await admin
        .from("requests")
        .select("status")
        .eq("id", requestId)
        .maybeSingle();
      const statusAfter = String(
        (requestAfter as any)?.status ?? requestStatus,
      ).toLowerCase();

      if (proUserId) {
        await admin.from("pro_calendar_events").upsert(
          {
            request_id: requestId,
            pro_id: proUserId,
            title: requestTitle,
            scheduled_date: requestScheduledDate,
            scheduled_time: requestScheduledTime,
            status: statusAfter === "finished" ? "finished" : "in_process",
          } as any,
          { onConflict: "request_id" },
        );
      }

      revalidatePath(`/requests/${requestId}`);
      revalidatePath(`/requests/explore/${requestId}`);
      revalidatePath("/requests/explore");
      revalidatePath("/requests");
      revalidatePath("/pro");
      revalidatePath("/pro/calendar");
      revalidateTag("pro-calendar");
      if (convId) revalidatePath(`/mensajes/${convId}`);
      if (proUserId) {
        revalidatePath(`/profiles/${proUserId}`);
        revalidateTag(`profile:${proUserId}`);
      }
    } catch {
      /* ignore */
    }

    try {
      if (toUserId) revalidateTag(`profile:${toUserId}`);
    } catch {
      /* ignore */
    }

    return NextResponse.json(
      { ok: true, id: insertedRatingId },
      { status: 200, headers: JSONH },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500, headers: JSONH });
  }
}
