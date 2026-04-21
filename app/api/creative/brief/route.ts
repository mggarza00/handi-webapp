import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { readRequestPayload } from "@/lib/campaigns/http";
import { previewCreativeBrief } from "@/lib/creative/repository";
import { creativeBriefInputSchema } from "@/lib/creative/schemas";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  try {
    const raw = await readRequestPayload(req);
    const parsed = creativeBriefInputSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_payload",
          detail: parsed.error.flatten(),
        },
        { status: 422, headers: JSONH },
      );
    }

    const admin = getAdminSupabase();
    const result = await previewCreativeBrief({
      admin,
      campaignDraftId: parsed.data.campaignDraftId,
      campaignMessageId: parsed.data.campaignMessageId,
      channel: parsed.data.channel,
      format: parsed.data.format,
      notes: parsed.data.notes,
    });

    return NextResponse.json(
      {
        ok: true,
        campaignTitle: result.campaignTitle,
        messageVariantName: result.messageVariantName,
        brief: result.brief,
      },
      { headers: JSONH },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed to build creative brief";
    return NextResponse.json(
      { ok: false, error: "internal_error", detail: message },
      { status: 500, headers: JSONH },
    );
  }
}

export function GET() {
  return NextResponse.json(
    { ok: false, error: "method_not_allowed" },
    { status: 405, headers: JSONH },
  );
}
