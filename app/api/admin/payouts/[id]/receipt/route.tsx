/* eslint-disable import/order */
import { NextResponse } from "next/server";

import { assertAdminOrJson } from "@/lib/auth-admin";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { PayoutReceiptTemplate } from "@/components/pdf/PayoutReceiptTemplate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  const admin = getAdminSupabase();
  const { data: payout } = await admin
    .from("payouts")
    .select(
      "id, request_id, agreement_id, professional_id, amount, currency, created_at, stripe_transfer_id",
    )
    .eq("id", params.id)
    .maybeSingle();
  if (!payout) return new NextResponse("Not found", { status: 404 });

  const { data: prof } = await admin
    .from("profiles")
    .select("email, full_name")
    .eq("id", payout.professional_id)
    .maybeSingle();

  const data = {
    payoutId: payout.id as string,
    createdAtISO: (payout.created_at as string) || new Date().toISOString(),
    professionalName: (prof as any)?.full_name || "Profesional",
    professionalEmail: (prof as any)?.email || "-",
    amount: Number(payout.amount ?? 0),
    currency: (payout.currency as string) || "MXN",
    requestId: (payout.request_id as string | null) || null,
    agreementId: (payout.agreement_id as string | null) || null,
    transferId: (payout.stripe_transfer_id as string | null) || null,
  };

  try {
    const pdfLib: any = await import("@react-pdf/renderer");
    const doc = <PayoutReceiptTemplate data={data} />;
    const stream = await pdfLib.renderToStream(doc);
    const buf = await streamToBuffer(stream);
    return new NextResponse(buf as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename=handi-payout-${params.id}.pdf`,
      },
    });
  } catch {
    return new NextResponse("PDF unavailable (missing @react-pdf/renderer)", {
      status: 503,
    });
  }
}

async function streamToBuffer(stream: any): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
