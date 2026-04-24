import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { notifyAdminsEmail, notifyAdminsInApp } from "@/lib/admin/admin-notify";
import { sendEmail } from "@/lib/email";
import { payoutPaidProfessionalHtml } from "@/lib/email-templates";
import {
  computeProfessionalPayoutBreakdown,
  getManualPayoutCandidates,
} from "@/lib/payouts/manual";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MANUAL_PAYOUT_BUCKET = "payout-receipts";
const ALLOWED_RECEIPT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: currency || "MXN",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)} ${currency || "MXN"}`;
  }
}

function sanitizeFilename(name: string): string {
  const cleaned = name.trim().replace(/[^a-zA-Z0-9._-]/g, "-");
  return cleaned.length ? cleaned : "comprobante";
}

function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000"
  );
}

export async function POST(req: Request) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  try {
    const form = await req.formData();
    const candidateId = String(form.get("candidateId") || "").trim();
    const receipt = form.get("receipt");

    if (!candidateId) {
      return NextResponse.json(
        { ok: false, error: "CANDIDATE_REQUIRED" },
        { status: 400, headers: JSONH },
      );
    }

    if (!(receipt instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "RECEIPT_REQUIRED" },
        { status: 400, headers: JSONH },
      );
    }

    if (!ALLOWED_RECEIPT_TYPES.has(receipt.type)) {
      return NextResponse.json(
        { ok: false, error: "INVALID_RECEIPT_TYPE" },
        { status: 400, headers: JSONH },
      );
    }

    const admin = getAdminSupabase();
    const { items, commissionPercent } = await getManualPayoutCandidates(admin);
    const candidate =
      items.find((item) => item.candidateId === candidateId) ?? null;

    if (!candidate) {
      return NextResponse.json(
        { ok: false, error: "CANDIDATE_NOT_FOUND" },
        { status: 404, headers: JSONH },
      );
    }

    if (!candidate.canCreate) {
      return NextResponse.json(
        {
          ok: false,
          error: "REQUEST_NOT_FINALIZED",
          detail: candidate.blockReason,
        },
        { status: 409, headers: JSONH },
      );
    }

    const existingPayout = candidate.payoutId
      ? await admin
          .from("payouts")
          .select("id, status, metadata")
          .eq("id", candidate.payoutId)
          .maybeSingle()
      : { data: null };
    const existingStatus =
      existingPayout.data &&
      typeof existingPayout.data === "object" &&
      "status" in existingPayout.data
        ? String((existingPayout.data as { status?: unknown }).status ?? "")
        : "";
    if (existingStatus.toLowerCase() === "paid") {
      return NextResponse.json(
        { ok: false, error: "PAYOUT_ALREADY_PAID" },
        { status: 409, headers: JSONH },
      );
    }

    const breakdown = computeProfessionalPayoutBreakdown(
      candidate.grossAmount,
      commissionPercent,
    );
    const buffer = Buffer.from(await receipt.arrayBuffer());

    const { data: existingBucket } = await admin.storage
      .getBucket(MANUAL_PAYOUT_BUCKET)
      .catch(() => ({ data: null }) as { data: null });
    if (!existingBucket) {
      const { error: createBucketError } = await admin.storage.createBucket(
        MANUAL_PAYOUT_BUCKET,
        {
          public: true,
          fileSizeLimit: "10485760",
          allowedMimeTypes: Array.from(ALLOWED_RECEIPT_TYPES),
        },
      );
      if (createBucketError) {
        return NextResponse.json(
          { ok: false, error: createBucketError.message },
          { status: 400, headers: JSONH },
        );
      }
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const safeFilename = sanitizeFilename(receipt.name);
    const storagePath = [
      "manual",
      candidate.professionalId,
      candidate.requestId,
      `${now.getTime()}-${safeFilename}`,
    ].join("/");
    const { error: uploadError } = await admin.storage
      .from(MANUAL_PAYOUT_BUCKET)
      .upload(storagePath, buffer, {
        contentType: receipt.type,
        upsert: false,
      });
    if (uploadError) {
      return NextResponse.json(
        { ok: false, error: uploadError.message },
        { status: 400, headers: JSONH },
      );
    }
    const receiptUrl = admin.storage
      .from(MANUAL_PAYOUT_BUCKET)
      .getPublicUrl(storagePath).data.publicUrl;

    const metadata = {
      ...((existingPayout.data as { metadata?: Record<string, unknown> } | null)
        ?.metadata ?? {}),
      source: "manual_payout",
      payout_mode: "manual",
      amount_basis: "net",
      gross_amount: breakdown.grossAmount,
      commission_pro_percent: breakdown.commissionPercent,
      commission_pro_amount: breakdown.commissionAmount,
      receipt_bucket: MANUAL_PAYOUT_BUCKET,
      receipt_path: storagePath,
      receipt_mime: receipt.type,
      receipt_filename: safeFilename,
      paid_manually_by: gate.userId,
      paid_manually_at: nowIso,
    };

    let payoutId = candidate.payoutId;
    if (candidate.payoutId) {
      const { error: updateError } = await admin
        .from("payouts")
        .update({
          agreement_id: candidate.agreementId,
          request_id: candidate.requestId,
          professional_id: candidate.professionalId,
          amount: breakdown.netAmount,
          currency: candidate.currency,
          status: "paid",
          paid_at: nowIso,
          receipt_url: receiptUrl,
          metadata,
        })
        .eq("id", candidate.payoutId);
      if (updateError) {
        return NextResponse.json(
          { ok: false, error: updateError.message },
          { status: 500, headers: JSONH },
        );
      }
    } else {
      const { data: inserted, error: insertError } = await admin
        .from("payouts")
        .insert({
          agreement_id: candidate.agreementId,
          request_id: candidate.requestId,
          professional_id: candidate.professionalId,
          amount: breakdown.netAmount,
          currency: candidate.currency,
          status: "paid",
          paid_at: nowIso,
          receipt_url: receiptUrl,
          metadata,
        })
        .select("id")
        .maybeSingle();
      if (insertError) {
        return NextResponse.json(
          { ok: false, error: insertError.message },
          { status: 500, headers: JSONH },
        );
      }
      payoutId =
        inserted && typeof inserted === "object" && "id" in inserted
          ? String((inserted as { id?: unknown }).id ?? "")
          : null;
    }

    const amountText = formatMoney(breakdown.netAmount, candidate.currency);
    const payoutDateLabel = new Intl.DateTimeFormat("es-MX", {
      dateStyle: "long",
      timeStyle: "short",
    }).format(now);
    const estimatedArrivalText = "24 a 72 horas hábiles";
    const baseUrl = getBaseUrl();

    try {
      let professionalEmail = candidate.professionalEmail;
      if (!professionalEmail) {
        const authUser = await admin.auth.admin
          .getUserById(candidate.professionalId)
          .catch(() => null);
        professionalEmail = authUser?.data?.user?.email ?? null;
      }
      if (professionalEmail) {
        const html = payoutPaidProfessionalHtml({
          professionalName: candidate.professionalName,
          requestTitle: candidate.requestTitle,
          amountText,
          payoutDateLabel,
          estimatedArrivalText,
          receiptUrl,
          supportEmail: "soporte@handi.mx",
        });
        await sendEmail({
          to: professionalEmail,
          subject: "Handi - Tu payout ha sido confirmado",
          html,
          attachments: [
            {
              filename: safeFilename,
              content:
                receipt.type === "application/pdf"
                  ? buffer.toString("base64")
                  : buffer,
              mime: receipt.type,
            },
          ],
        }).catch(() => null);
      }
    } catch {
      /* ignore email failures */
    }

    try {
      await admin.from("user_notifications").insert({
        user_id: candidate.professionalId,
        type: "payout:paid",
        title: "Recibiste un payout",
        body: `Se confirmó tu payout de ${amountText} por ${candidate.requestTitle}.`,
        link: "/pro",
      });
    } catch {
      /* ignore notification failures */
    }

    try {
      await notifyAdminsInApp(admin, {
        type: "payout:paid",
        title: "Payout manual confirmado",
        body: `${candidate.professionalName} recibió ${amountText}.`,
        link: "/admin/payouts",
      });
      await notifyAdminsEmail({
        subject: "HANDI - Payout manual confirmado",
        html: `
          <p>Se confirmó un payout manual.</p>
          <ul>
            <li>Profesional: <strong>${candidate.professionalName}</strong></li>
            <li>Servicio: <strong>${candidate.requestTitle}</strong></li>
            <li>Monto: <strong>${amountText}</strong></li>
            <li>Payout ID: <strong>${payoutId ?? "pendiente"}</strong></li>
          </ul>
          <p><a href="${baseUrl}/admin/payouts">Abrir payouts</a></p>
        `,
      });
    } catch {
      /* ignore admin notifications */
    }

    try {
      revalidatePath("/admin/payouts");
      revalidatePath("/pro");
      revalidatePath("/pro/calendar");
      revalidatePath(`/profiles/${candidate.professionalId}`);
      revalidateTag("pro-calendar");
    } catch {
      /* ignore revalidation errors */
    }

    return NextResponse.json(
      {
        ok: true,
        data: {
          id: payoutId,
          status: "paid",
          amount: breakdown.netAmount,
          currency: candidate.currency,
          receipt_url: receiptUrl,
        },
      },
      { headers: JSONH },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: JSONH },
    );
  }
}
