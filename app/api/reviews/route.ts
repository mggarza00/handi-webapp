import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import createClient from "@/utils/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { revalidatePath, revalidateTag } from "next/cache";

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
        "id, created_by, title, professional_id, accepted_professional_id, scheduled_date, scheduled_time",
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

    let toUserId: string | null = null;
    if (reviewerRole === "client") {
      toUserId = professionalId ?? null;
    } else {
      toUserId = clientId ?? ownerId;
    }
    if (!toUserId) {
      return NextResponse.json(
        { error: "MISSING_COUNTERPART" },
        { status: 400, headers: JSONH },
      );
    }

    let allowed = me === ownerId;
    if (!allowed) {
      const { data: convs } = await admin
        .from("conversations")
        .select("id")
        .eq("request_id", requestId)
        .or(`customer_id.eq.${me},pro_id.eq.${me}`)
        .limit(1);
      allowed = Array.isArray(convs) && convs.length > 0;
    }
    if (!allowed) {
      return NextResponse.json(
        { error: "FORBIDDEN" },
        { status: 403, headers: JSONH },
      );
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

    const ins = await admin
      .from("ratings")
      .insert({
        request_id: requestId,
        from_user_id: me,
        to_user_id: toUserId,
        stars: rating,
        comment: comment ?? null,
      })
      .select("id")
      .single();
    if (ins.error) {
      return NextResponse.json(
        { error: ins.error.message },
        { status: 400, headers: JSONH },
      );
    }

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
      const { data: conv } = await admin
        .from("conversations")
        .select("customer_id, pro_id, id")
        .eq("request_id", requestId)
        .order("last_message_at", { ascending: false })
        .maybeSingle();

      const customerId = (conv as any)?.customer_id as string | undefined;
      const proUserId = (conv as any)?.pro_id as string | undefined;
      const convId = (conv as any)?.id as string | undefined;

      if (customerId && proUserId) {
        const { data: both } = await admin
          .from("ratings")
          .select("from_user_id")
          .eq("request_id", requestId);
        const set = new Set<string>(
          (both || []).map((r: any) => String(r.from_user_id)),
        );

        if (set.has(customerId) && set.has(proUserId)) {
          await admin
            .from("requests")
            .update({
              status: "finished",
              completed_at: new Date().toISOString(),
            } as any)
            .eq("id", requestId);

          const requestTitle =
            typeof (reqRow as any)?.title === "string"
              ? ((reqRow as any).title as string)
              : "Servicio";
          const requestProId =
            ((reqRow as any)?.accepted_professional_id as string | undefined) ||
            ((reqRow as any)?.professional_id as string | undefined) ||
            proUserId;
          const requestScheduledDate =
            ((reqRow as any)?.scheduled_date as string | undefined) || null;
          const requestScheduledTime =
            ((reqRow as any)?.scheduled_time as string | undefined) || null;

          try {
            if (requestProId) {
              await (admin as any).from("pro_calendar_events").upsert(
                {
                  request_id: requestId,
                  pro_id: requestProId,
                  title: requestTitle,
                  scheduled_date: requestScheduledDate,
                  scheduled_time: requestScheduledTime,
                  status: "finished",
                },
                { onConflict: "request_id" },
              );
            }
          } catch {
            /* ignore */
          }

          try {
            revalidatePath(`/requests/${requestId}`);
            revalidatePath(`/requests/explore/${requestId}`);
            revalidatePath("/requests/explore");
            revalidatePath("/requests");
            revalidatePath("/pro");
            revalidatePath("/pro/calendar");
            revalidateTag("pro-calendar");
            if (convId) revalidatePath(`/mensajes/${convId}`);
            if (requestProId) {
              revalidatePath(`/profiles/${requestProId}`);
              revalidateTag(`profile:${requestProId}`);
            }
          } catch {
            /* ignore */
          }
        } else {
          try {
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
        }
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
      { ok: true, id: (ins.data as any)?.id ?? null },
      { status: 200, headers: JSONH },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500, headers: JSONH });
  }
}
