/* eslint-disable @typescript-eslint/no-explicit-any */
import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { notifyAdminsEmail, notifyAdminsInApp } from "@/lib/admin/admin-notify";
import { getAdminSupabase } from "@/lib/supabase/admin";
import createClient from "@/utils/supabase/server";

const Body = z.object({
  nextStatus: z.enum(["scheduled", "in_process", "completed"]),
});

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const requestId = params.id;
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400, headers: JSONH },
      );
    }
    const next = parsed.data.nextStatus;

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
        "id, created_by, status, title, professional_id, accepted_professional_id",
      )
      .eq("id", requestId)
      .maybeSingle();
    if (!reqRow) {
      return NextResponse.json(
        { error: "NOT_FOUND" },
        { status: 404, headers: JSONH },
      );
    }

    const current = String((reqRow as any).status ?? "").toLowerCase();
    const ownerId = String((reqRow as any).created_by ?? "");
    const assignedProId =
      ((reqRow as any)?.accepted_professional_id as string | undefined) ||
      ((reqRow as any)?.professional_id as string | undefined) ||
      null;
    const requestTitle =
      typeof (reqRow as any)?.title === "string"
        ? ((reqRow as any).title as string)
        : "Servicio";

    let allowed = me === ownerId || assignedProId === me;
    if (!allowed) {
      const { data: agreements } = await admin
        .from("agreements")
        .select("id")
        .eq("request_id", requestId)
        .eq("professional_id", me)
        .in("status", ["accepted", "paid", "in_progress", "completed"])
        .limit(1);
      allowed = Array.isArray(agreements) && agreements.length > 0;
    }
    if (!allowed) {
      const { data: convs } = await admin
        .from("conversations")
        .select("id")
        .eq("request_id", requestId)
        .eq("pro_id", me)
        .limit(1);
      allowed = Array.isArray(convs) && convs.length > 0;
    }
    if (!allowed) {
      return NextResponse.json(
        { error: "FORBIDDEN" },
        { status: 403, headers: JSONH },
      );
    }

    const normalizedNext = next === "completed" ? "finished" : next;
    const ok =
      (current === "active" &&
        (normalizedNext === "scheduled" || normalizedNext === "in_process")) ||
      (current === "scheduled" &&
        (normalizedNext === "in_process" || normalizedNext === "finished")) ||
      (current === "in_process" && normalizedNext === "finished") ||
      current === normalizedNext;
    if (!ok) {
      return NextResponse.json(
        { error: `INVALID_TRANSITION ${current} -> ${normalizedNext}` },
        { status: 400, headers: JSONH },
      );
    }

    const { error: upErr } = await admin
      .from("requests")
      .update({ status: normalizedNext } as any)
      .eq("id", requestId);
    if (upErr) {
      return NextResponse.json(
        { error: upErr.message },
        { status: 400, headers: JSONH },
      );
    }

    try {
      const { data: conv } = await admin
        .from("conversations")
        .select("pro_id, id")
        .eq("request_id", requestId)
        .order("created_at", { ascending: false })
        .maybeSingle();
      const proId =
        ((conv as any)?.pro_id as string | undefined) ||
        assignedProId ||
        undefined;
      const convId = (conv as any)?.id as string | undefined;
      if (proId) {
        await admin.from("pro_calendar_events").upsert(
          {
            request_id: requestId,
            pro_id: proId,
            title: requestTitle || "Servicio",
            status: normalizedNext,
          } as any,
          { onConflict: "request_id" },
        );
      }

      if (normalizedNext === "finished" && proId) {
        try {
          const { data: existingPayout } = await admin
            .from("payouts")
            .select("id")
            .eq("request_id", requestId)
            .eq("professional_id", proId)
            .maybeSingle();
          if (!existingPayout?.id) {
            let agreementId: string | null = null;
            let amount: number | null = null;
            let currency = "MXN";

            try {
              const { data: agr } = await admin
                .from("agreements")
                .select("id, amount")
                .eq("request_id", requestId)
                .eq("professional_id", proId)
                .maybeSingle();
              agreementId = (agr as any)?.id ?? null;
              const amt = Number((agr as any)?.amount ?? NaN);
              if (Number.isFinite(amt) && amt > 0) amount = amt;
            } catch {
              /* ignore */
            }

            if ((amount ?? 0) <= 0 && convId) {
              try {
                const { data: offs } = await admin
                  .from("offers")
                  .select("amount, currency")
                  .eq("conversation_id", convId)
                  .eq("professional_id", proId)
                  .order("created_at", { ascending: false })
                  .limit(1);
                const off = Array.isArray(offs) && offs.length ? offs[0] : null;
                const amt = Number((off as any)?.amount ?? NaN);
                if (Number.isFinite(amt) && amt > 0) amount = amt;
                const cur = ((off as any)?.currency as string | null) || null;
                if (cur) currency = cur.toUpperCase();
              } catch {
                /* ignore */
              }
            }

            if (amount && amount > 0) {
              try {
                await admin.from("payouts").insert({
                  agreement_id: agreementId,
                  request_id: requestId,
                  professional_id: proId,
                  amount,
                  currency,
                  status: "pending",
                  metadata: {
                    source: "request_status",
                    request_status: normalizedNext,
                  },
                });
                const amountText = `$${amount.toFixed(2)} ${currency}`;
                await notifyAdminsInApp(admin, {
                  type: "payout:pending",
                  title: "Payout pendiente",
                  body: `Trabajo finalizado. Pagar ${amountText} a profesional`,
                  link: "/admin/payouts",
                });
                const base =
                  process.env.NEXT_PUBLIC_APP_URL ||
                  process.env.NEXT_PUBLIC_SITE_URL ||
                  "http://localhost:3000";
                const html = `
                  <p>Se genero un payout pendiente.</p>
                  <ul>
                    <li>Monto: <strong>${amountText}</strong></li>
                    <li>Request ID: ${requestId}</li>
                    <li>Profesional: ${proId}</li>
                    <li>Servicio: ${requestTitle || "Servicio"}</li>
                  </ul>
                  <p><a href="${base}/admin/payouts">Abrir payouts</a></p>
                `;
                await notifyAdminsEmail({
                  subject: "HANDI - Trabajo finalizado (payout pendiente)",
                  html,
                });
              } catch {
                /* ignore */
              }
            }
          }
        } catch {
          /* ignore */
        }
      }

      try {
        revalidatePath("/pro/calendar");
        revalidateTag("pro-calendar");
        if (convId) revalidatePath(`/mensajes/${convId}`);
      } catch {
        /* ignore */
      }
    } catch {
      /* ignore */
    }

    try {
      revalidatePath("/requests/explore");
      revalidatePath(`/requests/${requestId}`);
      revalidatePath("/pro/calendar");
      revalidateTag("pro-calendar");
    } catch {
      /* ignore */
    }

    return NextResponse.json(
      { ok: true, data: { id: requestId, status: next } },
      { status: 200, headers: JSONH },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500, headers: JSONH });
  }
}
