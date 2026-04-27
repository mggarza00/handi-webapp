import { createHash } from "crypto";

import { revalidatePath, revalidateTag } from "next/cache";

import { notifyChatMessageByConversation } from "@/lib/chat-notifier";
import { sendEmail } from "@/lib/email";
import { notifyAdminsEmail, notifyAdminsInApp } from "@/lib/admin/admin-notify";
import { computeClientTotals } from "@/lib/payments/fees";
import { recordPayment } from "@/lib/payments/record-payment";
import { getStripeForMode, type StripeMode } from "@/lib/stripe";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";

type FinalizeArgs = {
  offerId: string;
  paymentIntentId?: string | null;
  source: "webhook" | "sync";
};

type FinalizeResult = {
  ok: boolean;
  requestId?: string | null;
  conversationId?: string | null;
  proId?: string | null;
};

type AgreementUpdate = Database["public"]["Tables"]["agreements"]["Update"];
type AgreementInsert = Database["public"]["Tables"]["agreements"]["Insert"];
type RequestUpdate = Database["public"]["Tables"]["requests"]["Update"];
type MessageInsert = Database["public"]["Tables"]["messages"]["Insert"];
type ConversationRow = {
  request_id?: string | null;
  customer_id?: string | null;
  pro_id?: string | null;
};

type ParsedServiceDate = {
  date: string | null;
  time: string | null;
  displayTime: string | null;
};

type OfferScheduleResolution = {
  displayTime: string | null;
  dbTime: string | null;
};

function parseServiceDate(raw?: string | null): ParsedServiceDate {
  if (!raw)
    return {
      date: null,
      time: null,
      displayTime: null,
    };
  const trimmed = raw.trim();
  if (!trimmed)
    return {
      date: null,
      time: null,
      displayTime: null,
    };
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime()))
    return {
      date: null,
      time: null,
      displayTime: null,
    };
  const hhmm = dt.toISOString().slice(11, 16);
  return {
    date: dt.toISOString().slice(0, 10),
    time: hhmm,
    displayTime: hhmm,
  };
}

function hasExplicitTimeInIso(raw?: string | null): boolean {
  if (!raw || typeof raw !== "string") return false;
  const match = raw.trim().match(/T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return false;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  const ss = Number(match[3] || "0");
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || !Number.isFinite(ss)) {
    return false;
  }
  // If seconds/minutes are all zero, this is frequently a normalized day-only value.
  return mm > 0 || ss > 0;
}

function formatSingleTimeEsMx(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/horario\s+flexible/i.test(trimmed)) return "Horario flexible";
  if (/a\.?m\.?|p\.?m\.?/i.test(trimmed)) return trimmed;
  const match = trimmed.match(/^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);
  if (!match) return trimmed;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const am = hour < 12;
  const h12Raw = hour % 12;
  const h12 = h12Raw === 0 ? 12 : h12Raw;
  const mm = String(minute).padStart(2, "0");
  return `${h12}:${mm} ${am ? "a.m." : "p.m."}`;
}

function formatHourValueEsMx(value: number): string | null {
  if (!Number.isFinite(value)) return null;
  const normalized = Math.max(0, Math.min(24, value));
  const hour = Math.floor(normalized) % 24;
  const minute = Math.round((normalized - Math.floor(normalized)) * 60);
  const mm = String(Math.max(0, Math.min(59, minute))).padStart(2, "0");
  const am = hour < 12;
  const h12Raw = hour % 12;
  const h12 = h12Raw === 0 ? 12 : h12Raw;
  return `${h12}:${mm} ${am ? "a.m." : "p.m."}`;
}

function formatHourRangeEsMx(start: number, end: number): string | null {
  const from = formatHourValueEsMx(start);
  const to = formatHourValueEsMx(end);
  if (!from || !to) return null;
  if (start === end) return from;
  return `de ${from} a ${to}`;
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getMetadataSchedule(metadata: unknown): {
  flexible: boolean;
  start: number | null;
  end: number | null;
} {
  if (!metadata || typeof metadata !== "object") {
    return { flexible: false, start: null, end: null };
  }
  const record = metadata as Record<string, unknown>;
  const flexible = record.flexible_schedule === true;
  const schedule =
    record.schedule && typeof record.schedule === "object"
      ? (record.schedule as Record<string, unknown>)
      : null;
  const start =
    toNumberOrNull(schedule?.start_hour) ??
    toNumberOrNull(record.schedule_start_hour);
  const end =
    toNumberOrNull(schedule?.end_hour) ??
    toNumberOrNull(record.schedule_end_hour);
  return { flexible, start, end };
}

function extractScheduleFromDescription(
  description: string | null | undefined,
): OfferScheduleResolution {
  const raw = toTextOrNull(description);
  if (!raw) return { displayTime: null, dbTime: null };
  if (/horario\s+flexible/i.test(raw)) {
    return { displayTime: "Horario flexible", dbTime: null };
  }
  const lineMatch = raw.match(/horario:\s*([^\r\n]+)/i);
  const line = lineMatch?.[1]?.trim() || null;
  if (!line) return { displayTime: null, dbTime: null };
  const rangeParts = line
    .split(/\s*[—-]\s*/)
    .filter((part) => part.trim().length);
  if (rangeParts.length >= 2) {
    return {
      displayTime: `de ${rangeParts[0].trim()} a ${rangeParts[1].trim()}`,
      dbTime: null,
    };
  }
  return {
    displayTime: formatSingleTimeEsMx(line),
    dbTime: toDbTimeOrNull(line),
  };
}

function resolveOfferScheduleDisplay(input: {
  agreementScheduledTime?: string | null;
  offerMetadata?: unknown;
  offerDescription?: string | null;
  requestScheduledTime?: string | null;
  parsedService: ParsedServiceDate;
  rawServiceDate?: string | null;
}): OfferScheduleResolution {
  const agreement = toTextOrNull(input.agreementScheduledTime);
  if (agreement) {
    return {
      displayTime: formatSingleTimeEsMx(agreement),
      dbTime: toDbTimeOrNull(agreement),
    };
  }

  const metadataSchedule = getMetadataSchedule(input.offerMetadata);
  if (metadataSchedule.flexible) {
    return { displayTime: "Horario flexible", dbTime: null };
  }
  if (metadataSchedule.start != null && metadataSchedule.end != null) {
    const start = Math.min(metadataSchedule.start, metadataSchedule.end);
    const end = Math.max(metadataSchedule.start, metadataSchedule.end);
    return {
      displayTime: formatHourRangeEsMx(start, end),
      dbTime: toDbTimeOrNull(
        `${String(Math.floor(start)).padStart(2, "0")}:00`,
      ),
    };
  }
  if (metadataSchedule.start != null) {
    const db = `${String(Math.floor(metadataSchedule.start)).padStart(2, "0")}:00`;
    return {
      displayTime: formatHourValueEsMx(metadataSchedule.start),
      dbTime: toDbTimeOrNull(db),
    };
  }

  const fromDescription = extractScheduleFromDescription(
    input.offerDescription,
  );
  if (fromDescription.displayTime) return fromDescription;

  const requestTime = toTextOrNull(input.requestScheduledTime);
  if (requestTime) {
    return {
      displayTime: formatSingleTimeEsMx(requestTime),
      dbTime: toDbTimeOrNull(requestTime),
    };
  }

  if (hasExplicitTimeInIso(input.rawServiceDate) && input.parsedService.time) {
    return {
      displayTime: formatSingleTimeEsMx(input.parsedService.time),
      dbTime: toDbTimeOrNull(input.parsedService.time),
    };
  }

  return { displayTime: null, dbTime: null };
}

function isMissingPaymentIntent(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code || "";
  if (code === "resource_missing") return true;
  const message = err instanceof Error ? err.message : "";
  return message.includes("No such payment_intent");
}

function buildStableMessageId(seed: string) {
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function toTextOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function toDbTimeOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);
  if (!match) return null;
  return `${match[1]}:${match[2]}`;
}

export async function finalizeOfferPayment(
  args: FinalizeArgs,
): Promise<FinalizeResult> {
  try {
    const admin = getAdminSupabase();
    const offerId = args.offerId.trim();
    if (!offerId) return { ok: false };
    const { data: offer } = await admin
      .from("offers")
      .select(
        "id,status,conversation_id,client_id,professional_id,amount,currency,service_date,payment_intent_id,payment_mode,description,metadata",
      )
      .eq("id", offerId)
      .maybeSingle();
    if (!offer) return { ok: false };

    const nowIso = new Date().toISOString();
    const parsedService = parseServiceDate(offer.service_date ?? null);

    const conversationId = offer.conversation_id ?? null;
    let clientId = offer.client_id ?? null;
    let proId = offer.professional_id ?? null;
    let requestId: string | null = null;
    let requestTitle: string | null = null;
    let requestRequiredAt: string | null = null;
    let requestScheduledDate: string | null = null;
    let requestScheduledTime: string | null = null;
    let requestAddressLine: string | null = null;
    let requestCity: string | null = null;
    let proEmail: string | null = null;
    let proName: string | null = null;
    let agreementId: string | null = null;
    let agreementScheduledDate: string | null = null;
    let agreementScheduledTime: string | null = null;

    if (conversationId) {
      const { data: conv } = await admin
        .from("conversations")
        .select("request_id, customer_id, pro_id")
        .eq("id", conversationId)
        .maybeSingle();
      const convRow = conv as ConversationRow | null;
      requestId = convRow?.request_id ?? null;
      if (!clientId) clientId = convRow?.customer_id ?? null;
      if (!proId) proId = convRow?.pro_id ?? null;
    }

    if (requestId) {
      const { data: req } = await admin
        .from("requests")
        .select(
          "title, created_by, required_at, scheduled_date, scheduled_time, address_line, city",
        )
        .eq("id", requestId)
        .maybeSingle();
      const reqRow = (req ?? null) as {
        title?: string | null;
        created_by?: string | null;
        required_at?: string | null;
        scheduled_date?: string | null;
        scheduled_time?: string | null;
        address_line?: string | null;
        city?: string | null;
      } | null;
      requestTitle = reqRow?.title ?? "Servicio";
      if (!clientId) {
        clientId = reqRow?.created_by ?? null;
      }
      requestRequiredAt = reqRow?.required_at ?? null;
      requestScheduledDate = reqRow?.scheduled_date ?? null;
      requestScheduledTime = reqRow?.scheduled_time ?? null;
      requestAddressLine = reqRow?.address_line ?? null;
      requestCity = reqRow?.city ?? null;
    }
    if (proId) {
      try {
        const { data: profile } = await admin
          .from("profiles")
          .select("email, full_name")
          .eq("id", proId)
          .maybeSingle();
        const profileRow = profile as {
          email?: string | null;
          full_name?: string | null;
        } | null;
        proEmail = profileRow?.email ?? null;
        proName = profileRow?.full_name ?? null;
      } catch {
        /* ignore */
      }
    }

    if (requestId && proId) {
      try {
        const { data: agreementRows } = await admin
          .from("agreements")
          .select("id,status,scheduled_date,scheduled_time,updated_at")
          .eq("request_id", requestId)
          .eq("professional_id", proId)
          .order("updated_at", { ascending: false })
          .limit(10);
        const rows = Array.isArray(agreementRows)
          ? (agreementRows as Array<{
              id?: string | null;
              status?: string | null;
              scheduled_date?: string | null;
              scheduled_time?: string | null;
            }>)
          : [];
        const prioritized = rows.find(
          (row) =>
            Boolean(row?.scheduled_date || row?.scheduled_time) &&
            ["paid", "accepted", "in_progress", "completed"].includes(
              String(row?.status ?? "").toLowerCase(),
            ),
        );
        const selected =
          prioritized ||
          rows.find((row) =>
            Boolean(row?.scheduled_date || row?.scheduled_time),
          ) ||
          rows[0];
        if (selected?.id) {
          agreementId = selected.id;
          agreementScheduledDate = toTextOrNull(selected.scheduled_date);
          agreementScheduledTime = toTextOrNull(selected.scheduled_time);
        }
      } catch {
        /* ignore agreement prefetch */
      }
    }

    const offerSchedule = resolveOfferScheduleDisplay({
      agreementScheduledTime,
      offerMetadata: (offer as { metadata?: unknown } | null)?.metadata,
      offerDescription: toTextOrNull(
        (offer as { description?: string | null } | null)?.description,
      ),
      requestScheduledTime,
      parsedService,
      rawServiceDate: offer.service_date ?? null,
    });

    const scheduledDate =
      agreementScheduledDate ||
      parsedService.date ||
      requestScheduledDate ||
      (requestRequiredAt ? requestRequiredAt.slice(0, 10) : null) ||
      nowIso.slice(0, 10);
    const scheduledTimeForDb = offerSchedule.dbTime || "09:00";
    const scheduledTimeForMessage =
      offerSchedule.displayTime || formatSingleTimeEsMx(scheduledTimeForDb);
    const baseUrl = (
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000"
    ).replace(/\/$/, "");
    let receiptId: string | null = null;
    let receiptUrl: string | null = null;
    let receiptDownloadUrl: string | null = null;
    let receiptViewUrl: string | null = null;
    let paymentIntentMetadata: Record<string, unknown> | null = null;
    try {
      if (offer.id) {
        const { data: recByOfferRaw } = await admin
          .from("receipts")
          .select("id")
          .eq("offer_id", offer.id)
          .order("created_at", { ascending: false })
          .limit(1);
        const recByOffer = Array.isArray(recByOfferRaw)
          ? (recByOfferRaw as Array<{ id?: string | null }>)
          : [];
        if (recByOffer.length) {
          receiptId = recByOffer[0]?.id ?? null;
        }
      }
      if (!receiptId && offer.payment_intent_id) {
        const { data: recByPiRaw } = await admin
          .from("receipts")
          .select("id")
          .eq("payment_intent_id", offer.payment_intent_id)
          .order("created_at", { ascending: false })
          .limit(1);
        const recByPi = Array.isArray(recByPiRaw)
          ? (recByPiRaw as Array<{ id?: string | null }>)
          : [];
        if (recByPi.length) {
          receiptId = recByPi[0]?.id ?? null;
        }
      }
    } catch {
      /* ignore receipt lookup */
    }
    const paymentIntentId =
      args.paymentIntentId || offer.payment_intent_id || null;
    if (paymentIntentId) {
      let mode: StripeMode = offer.payment_mode === "test" ? "test" : "live";
      let stripe = await getStripeForMode(mode);
      if (!stripe) {
        stripe = await getStripeForMode("live");
        mode = "live";
      }
      if (stripe) {
        try {
          const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
            expand: ["latest_charge"],
          });
          paymentIntentMetadata =
            pi?.metadata && typeof pi.metadata === "object"
              ? (pi.metadata as Record<string, unknown>)
              : null;
          const charge =
            (pi as { latest_charge?: unknown } | null)?.latest_charge ?? null;
          if (typeof charge === "string") {
            const full = await stripe.charges.retrieve(charge);
            receiptUrl =
              typeof (full as { receipt_url?: string } | null)?.receipt_url ===
              "string"
                ? ((full as { receipt_url?: string }).receipt_url as string)
                : null;
          } else if (
            charge &&
            typeof (charge as { receipt_url?: unknown }).receipt_url ===
              "string"
          ) {
            receiptUrl =
              (charge as { receipt_url?: string }).receipt_url || null;
          }
        } catch (err) {
          if (isMissingPaymentIntent(err)) {
            const fallbackMode: StripeMode = mode === "live" ? "test" : "live";
            const fallbackStripe = await getStripeForMode(fallbackMode);
            if (fallbackStripe) {
              try {
                const pi = await fallbackStripe.paymentIntents.retrieve(
                  paymentIntentId,
                  { expand: ["latest_charge"] },
                );
                paymentIntentMetadata =
                  pi?.metadata && typeof pi.metadata === "object"
                    ? (pi.metadata as Record<string, unknown>)
                    : paymentIntentMetadata;
                const charge =
                  (pi as { latest_charge?: unknown } | null)?.latest_charge ??
                  null;
                if (typeof charge === "string") {
                  const full = await fallbackStripe.charges.retrieve(charge);
                  receiptUrl =
                    typeof (full as { receipt_url?: string } | null)
                      ?.receipt_url === "string"
                      ? ((full as { receipt_url?: string })
                          .receipt_url as string)
                      : null;
                } else if (
                  charge &&
                  typeof (charge as { receipt_url?: unknown }).receipt_url ===
                    "string"
                ) {
                  receiptUrl =
                    (charge as { receipt_url?: string }).receipt_url || null;
                }
              } catch {
                /* ignore fallback stripe */
              }
            }
          }
        }
      }
    }
    if (receiptId) {
      receiptDownloadUrl = `${baseUrl}/api/receipts/${encodeURIComponent(
        receiptId,
      )}/pdf`;
      receiptViewUrl = `${baseUrl}/receipts/${encodeURIComponent(receiptId)}`;
    }

    // Best-effort: persist payment row for admin reports
    try {
      const amount = typeof offer.amount === "number" ? offer.amount : 0;
      if (paymentIntentId && amount > 0) {
        const totals = computeClientTotals(amount);
        const paymentMeta: Record<string, unknown> = {
          payment_type: "offer_payment",
          offer_id: offer.id,
          payment_mode: offer.payment_mode || null,
          receipt_id: receiptId,
          receipt_url: receiptUrl,
          source: args.source,
        };
        const result = await recordPayment({
          admin,
          requestId,
          amount: totals.amount,
          fee: totals.fee,
          vat: totals.iva,
          currency: (offer.currency || "MXN").toUpperCase(),
          status: "paid",
          paymentIntentId,
          createdAt: nowIso,
          metadata: paymentMeta,
        });
        if (result.inserted) {
          const amountText = totals.amount.toFixed(2);
          const title = requestTitle || "Servicio";
          await notifyAdminsInApp(admin, {
            type: "payment:new",
            title: "Nuevo pago recibido",
            body: `Pago recibido por $${amountText} ${offer.currency || "MXN"} (Servicio: ${title})`,
            link: "/admin/payments",
          });
          const base =
            process.env.NEXT_PUBLIC_APP_URL ||
            process.env.NEXT_PUBLIC_SITE_URL ||
            "http://localhost:3000";
          const html = `
            <p>Se registro un nuevo pago.</p>
            <ul>
              <li>Monto: <strong>$${amountText} ${offer.currency || "MXN"}</strong></li>
              <li>Servicio: <strong>${title}</strong></li>
              <li>Request ID: ${requestId ?? "-"}</li>
              <li>Payment Intent: ${paymentIntentId}</li>
            </ul>
            <p><a href="${base}/admin/payments">Abrir pagos</a></p>
          `;
          await notifyAdminsEmail({
            subject: "HANDI - Nuevo pago recibido",
            html,
          });
        }
      }
    } catch {
      /* ignore */
    }

    await admin
      .from("offers")
      .update({
        status: "paid",
        payment_intent_id:
          args.paymentIntentId || offer.payment_intent_id || null,
        checkout_url: null,
        accepting_at: null,
        updated_at: nowIso,
      })
      .eq("id", offer.id);

    // Consume remunerable onsite credit once the final service payment is confirmed.
    try {
      const onsiteRequestIdRaw =
        paymentIntentMetadata?.onsite_request_id ??
        paymentIntentMetadata?.onsite_quote_request_id ??
        null;
      const onsiteRequestId =
        typeof onsiteRequestIdRaw === "string" &&
        onsiteRequestIdRaw.trim().length
          ? onsiteRequestIdRaw.trim()
          : null;
      if (onsiteRequestId) {
        const { data: onsiteRow } = await admin
          .from("onsite_quote_requests")
          .select(
            "id, conversation_id, request_id, status, is_remunerable, remuneration_applied_offer_id, remuneration_applied_at",
          )
          .eq("id", onsiteRequestId)
          .maybeSingle();
        const onsite = (onsiteRow ?? null) as {
          id?: string | null;
          conversation_id?: string | null;
          request_id?: string | null;
          status?: string | null;
          is_remunerable?: boolean | null;
          remuneration_applied_offer_id?: string | null;
          remuneration_applied_at?: string | null;
        } | null;
        if (
          onsite?.id &&
          onsite.is_remunerable === true &&
          String(onsite.status || "").toLowerCase() === "deposit_paid" &&
          (!conversationId ||
            !onsite.conversation_id ||
            onsite.conversation_id === conversationId) &&
          (!requestId || !onsite.request_id || onsite.request_id === requestId)
        ) {
          if (
            onsite.remuneration_applied_offer_id === offer.id &&
            onsite.remuneration_applied_at
          ) {
            // already consumed by this offer (idempotent)
          } else if (!onsite.remuneration_applied_at) {
            await admin
              .from("onsite_quote_requests")
              .update({
                remuneration_applied_offer_id: offer.id,
                remuneration_applied_at: nowIso,
              })
              .eq("id", onsite.id)
              .is("remuneration_applied_at", null)
              .is("remuneration_applied_offer_id", null)
              .eq("status", "deposit_paid")
              .eq("is_remunerable", true);
          }
        }
      }
    } catch {
      /* ignore onsite credit consumption errors */
    }

    if (requestId && proId) {
      try {
        let existing: {
          id?: string | null;
          status?: string | null;
          scheduled_date?: string | null;
          scheduled_time?: string | null;
        } | null = null;
        if (agreementId) {
          const { data } = await admin
            .from("agreements")
            .select("id,status,scheduled_date,scheduled_time")
            .eq("id", agreementId)
            .maybeSingle();
          existing = (data ?? null) as typeof existing;
        } else {
          const { data } = await admin
            .from("agreements")
            .select("id,status,scheduled_date,scheduled_time")
            .eq("request_id", requestId)
            .eq("professional_id", proId)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          existing = (data ?? null) as typeof existing;
        }
        if (existing?.id) {
          const patch: AgreementUpdate = { updated_at: nowIso };
          const st = String(existing.status ?? "").toLowerCase();
          if (!(st === "in_progress" || st === "completed")) {
            patch.status = "paid";
          }
          if (typeof offer.amount === "number") patch.amount = offer.amount;
          if (scheduledDate && !existing.scheduled_date) {
            patch.scheduled_date = scheduledDate;
          }
          if (scheduledTimeForDb && !existing.scheduled_time) {
            patch.scheduled_time = scheduledTimeForDb;
          }
          if (Object.keys(patch).length > 1) {
            await admin.from("agreements").update(patch).eq("id", existing.id);
          }
          agreementId = existing.id as string;
        }
      } catch {
        /* ignore select/update */
      }
      if (!agreementId) {
        try {
          const insertRow: AgreementInsert = {
            request_id: requestId,
            professional_id: proId,
            amount: typeof offer.amount === "number" ? offer.amount : null,
            status: "paid",
            scheduled_date: scheduledDate || null,
            scheduled_time: scheduledTimeForDb || null,
            created_at: nowIso,
            updated_at: nowIso,
          };
          const { data: ins } = await admin
            .from("agreements")
            .upsert(insertRow, { onConflict: "request_id,professional_id" })
            .select("id")
            .maybeSingle();
          if (ins?.id) agreementId = ins.id as string;
        } catch {
          /* ignore upsert */
        }
      }
      // Cancel other pending agreements for this request
      try {
        const cancelPatch: AgreementUpdate = {
          status: "cancelled",
          updated_at: nowIso,
        };
        await admin
          .from("agreements")
          .update(cancelPatch)
          .eq("request_id", requestId)
          .neq("professional_id", proId)
          .in("status", ["negotiating", "accepted", "paid"]);
      } catch {
        /* ignore */
      }
    }

    if (requestId) {
      const patch: RequestUpdate = {
        status: "scheduled",
        is_explorable: false,
        visible_in_explore: false,
        updated_at: nowIso,
      };
      if (proId) {
        patch.professional_id = proId;
        patch.accepted_professional_id = proId;
      }
      if (scheduledDate) patch.scheduled_date = scheduledDate;
      if (scheduledTimeForDb) patch.scheduled_time = scheduledTimeForDb;
      if (agreementId) patch.agreement_id = agreementId;
      if (!requestRequiredAt && scheduledDate)
        patch.required_at = scheduledDate;
      try {
        await admin.from("requests").update(patch).eq("id", requestId);
      } catch {
        /* ignore */
      }
    }

    if (requestId && proId) {
      try {
        const adminUntyped = admin as unknown as {
          from: (table: string) => {
            upsert: (values: unknown, options?: unknown) => Promise<unknown>;
          };
        };
        await adminUntyped.from("pro_calendar_events").upsert(
          {
            pro_id: proId,
            request_id: requestId,
            title: requestTitle || "Servicio",
            scheduled_date: scheduledDate || null,
            scheduled_time: scheduledTimeForDb || null,
            status: "scheduled",
            event_kind: "service",
          },
          { onConflict: "request_id" },
        );
      } catch {
        /* ignore calendar errors */
      }
    }

    if (conversationId && clientId) {
      const hasSystemMessage = async (
        match: Record<string, unknown>,
        messageId?: string,
      ) => {
        if (messageId) {
          const { data: existingById } = await admin
            .from("messages")
            .select("id")
            .eq("id", messageId)
            .maybeSingle();
          if (existingById?.id) return true;
        }
        const { data: existing } = await admin
          .from("messages")
          .select("id")
          .eq("conversation_id", conversationId)
          .eq("message_type", "system")
          .contains("payload", match)
          .limit(1);
        return Array.isArray(existing) && existing.length > 0;
      };
      try {
        const paidPayload: Record<string, unknown> = {
          offer_id: offer.id,
          agreement_id: agreementId,
          status: "paid",
          type: "service_scheduled_address",
          scheduled_date: scheduledDate || null,
          scheduled_time: scheduledTimeForMessage || null,
          address_line: toTextOrNull(requestAddressLine),
          city: toTextOrNull(requestCity),
          receipt_id: receiptId,
          receipt_url: receiptUrl,
          receipt_view_url: receiptViewUrl,
          receipt_download_url: receiptDownloadUrl,
        };
        const paidMessageId = buildStableMessageId(
          `paid:${conversationId}:${offer.id}`,
        );
        const { data: existingPaidById } = await admin
          .from("messages")
          .select("id")
          .eq("id", paidMessageId)
          .maybeSingle();
        const body = "Servicio agendado";
        const messageInsert: MessageInsert = {
          id: paidMessageId,
          conversation_id: conversationId,
          sender_id: clientId,
          body,
          message_type: "system",
          payload: paidPayload as MessageInsert["payload"],
        };
        await admin
          .from("messages")
          .upsert(messageInsert, { onConflict: "id" });
        if (!existingPaidById?.id) {
          await notifyChatMessageByConversation({
            conversationId,
            senderId: clientId,
            text: body,
          });
        }
        if (receiptId || receiptUrl) {
          let hasReceipt = false;
          const receiptMessageId = buildStableMessageId(
            `paid_receipt:${conversationId}:${offer.id}`,
          );
          if (receiptId) {
            hasReceipt = await hasSystemMessage(
              { receipt_id: receiptId },
              receiptMessageId,
            );
          }
          if (!hasReceipt) {
            hasReceipt = await hasSystemMessage(
              {
                offer_id: offer.id,
                status: "paid",
                type: "payment_receipt",
              },
              receiptMessageId,
            );
          }
          if (!hasReceipt) {
            const receiptPayload: Record<string, unknown> = {
              offer_id: offer.id,
              status: "paid",
              type: "payment_receipt",
            };
            if (receiptId) receiptPayload.receipt_id = receiptId;
            if (receiptViewUrl) receiptPayload.view_url = receiptViewUrl;
            if (receiptDownloadUrl)
              receiptPayload.download_url = receiptDownloadUrl;
            if (receiptUrl) receiptPayload.receipt_url = receiptUrl;
            const messageInsert: MessageInsert = {
              id: receiptMessageId,
              conversation_id: conversationId,
              sender_id: clientId,
              body: "Comprobante de pago",
              message_type: "system",
              payload: receiptPayload as MessageInsert["payload"],
            };
            await admin
              .from("messages")
              .upsert(messageInsert, { onConflict: "id" });
          }
        }
      } catch {
        /* ignore */
      }
    }

    let notifiedPro = false;
    if (proId) {
      try {
        const link = conversationId
          ? `${baseUrl}/mensajes/${encodeURIComponent(conversationId)}`
          : `${baseUrl}/pro`;
        const addressLine = requestAddressLine?.toString().trim() || "";
        const city = requestCity?.toString().trim() || "";
        const line = [addressLine, city].filter(Boolean).join(", ");
        const body = line
          ? `La oferta fue pagada. Servicio agendado en ${line}.`
          : "La oferta fue pagada. Servicio agendado.";
        const { data: existing } = await admin
          .from("user_notifications")
          .select("id")
          .eq("user_id", proId)
          .eq("type", "contract_offer_paid")
          .eq("link", link)
          .limit(1);
        const has = Array.isArray(existing) && existing.length > 0;
        if (!has) {
          const adminUntyped = admin as unknown as {
            from: (table: string) => {
              insert: (values: unknown) => Promise<unknown>;
            };
          };
          await adminUntyped.from("user_notifications").insert({
            user_id: proId,
            type: "contract_offer_paid",
            title: "Oferta pagada",
            body,
            link,
          });
          notifiedPro = true;
        }
      } catch {
        /* ignore */
      }
    }

    if (proEmail && notifiedPro) {
      try {
        const title = requestTitle || "Servicio";
        const proUrl = `${baseUrl}/pro`;
        const calendarUrl = `${baseUrl}/pro/calendar`;
        const chatUrl = conversationId
          ? `${baseUrl}/mensajes/${encodeURIComponent(conversationId)}`
          : null;
        const subject = "Handi - Tu oferta fue pagada";
        const safeTitle = title.replace(/&/g, "&amp;").replace(/</g, "&lt;");
        const safeName = (proName || "Profesional")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;");
        const addressLine = requestAddressLine?.toString().trim() || "";
        const city = requestCity?.toString().trim() || "";
        const addressLineHtml =
          addressLine || city
            ? `<p><strong>Dirección:</strong> ${(addressLine || "")
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")}${
                city
                  ? `, ${city.replace(/&/g, "&amp;").replace(/</g, "&lt;")}`
                  : ""
              }</p>`
            : "";
        const links = [
          `<li><a href="${proUrl}">Ir a tu dashboard</a></li>`,
          `<li><a href="${calendarUrl}">Ver calendario</a></li>`,
          chatUrl ? `<li><a href="${chatUrl}">Abrir chat</a></li>` : null,
        ]
          .filter(Boolean)
          .join("");
        const html = `
          <p>Hola ${safeName},</p>
          <p>Tu oferta de contratacion (<strong>${safeTitle}</strong>) ha sido pagada.</p>
          <p>El servicio se ha agendado y ya aparece en tu cuenta.</p>
          ${addressLineHtml}
          <ul>${links}</ul>
        `;
        await sendEmail({ to: proEmail, subject, html }).catch(() => null);
      } catch {
        /* ignore */
      }
    }

    try {
      if (requestId) revalidatePath(`/requests/${requestId}`);
      if (conversationId) revalidatePath(`/mensajes/${conversationId}`);
      revalidatePath("/pro");
      revalidatePath("/pro/calendar");
      revalidateTag("pro-calendar");
    } catch {
      /* ignore */
    }

    return { ok: true, requestId, conversationId, proId };
  } catch {
    return { ok: false };
  }
}

export const __finalizeOfferPaymentInternals = {
  hasExplicitTimeInIso,
  formatHourRangeEsMx,
  formatSingleTimeEsMx,
  resolveOfferScheduleDisplay,
};
