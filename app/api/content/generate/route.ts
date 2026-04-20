import { NextResponse } from "next/server";
import { z } from "zod";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { generateContentProposal } from "@/lib/campaigns/generation";
import {
  readRequestPayload,
  respondWithRedirectOrJson,
} from "@/lib/campaigns/http";
import {
  buildPersistInputFromContentProposal,
  createPersistedCampaignDraft,
} from "@/lib/campaigns/repository";
import { contentGenerationInputSchema } from "@/lib/ai/schemas";
import { logAudit } from "@/lib/log-audit";
import { getAdminSupabase } from "@/lib/supabase/server";

const FormSchema = z.object({
  title: z.string().optional(),
  audience: z.string(),
  goal: z.string(),
  channel: z.string(),
  format: z.string(),
  serviceCategory: z.string(),
  offer: z.string(),
  cta: z.string(),
  tonePreference: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  redirectTo: z.string().optional(),
});

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  try {
    const raw = await readRequestPayload(req);
    const normalized = {
      title: raw.title,
      audience: raw.audience,
      goal: raw.goal,
      channel: raw.channel,
      format: raw.format,
      serviceCategory: raw.serviceCategory,
      offer: raw.offer,
      cta: raw.cta,
      tonePreference: raw.tonePreference,
      notes: raw.notes,
    };

    const formParsed = FormSchema.safeParse({
      ...normalized,
      redirectTo: raw.redirectTo,
    });
    const parsed = contentGenerationInputSchema.safeParse(normalized);

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
    if (!formParsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_payload",
          detail: formParsed.error.flatten(),
        },
        { status: 422, headers: JSONH },
      );
    }

    const admin = getAdminSupabase();
    const proposal = await generateContentProposal(parsed.data);
    const persisted = await createPersistedCampaignDraft(
      buildPersistInputFromContentProposal({
        admin,
        createdBy: gate.userId,
        input: parsed.data,
        proposal,
      }),
    );

    await logAudit({
      actorId: gate.userId,
      action: "CAMPAIGN_CONTENT_GENERATED",
      entity: "campaign_drafts",
      entityId: persisted.draft.id,
      meta: {
        title: parsed.data.title || null,
        audience: parsed.data.audience,
        goal: parsed.data.goal,
        channel: parsed.data.channel,
        tonePreference: parsed.data.tonePreference || null,
        generationProvider: proposal.provider.activeProvider,
        generationProviderStatus: proposal.provider.status,
        generationMode: proposal.provider.generationMode,
        generationModel: proposal.provider.model,
        generationFallbackReason: proposal.provider.fallbackReason,
        generationRequestId: proposal.provider.requestId,
      },
    });

    return respondWithRedirectOrJson({
      req,
      redirectTo:
        formParsed.data.redirectTo || `/admin/campaigns/${persisted.draft.id}`,
      payload: {
        ok: true,
        draftId: persisted.draft.id,
        messageIds: persisted.messages.map((message) => message.id),
        brandContext: proposal.brandContext,
        rationaleSummary: proposal.rationaleSummary,
        recommendedAngle: proposal.recommendedAngle,
        variants: persisted.messages,
        guardrailsApplied: proposal.guardrailsApplied,
        provider: proposal.provider,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "unknown content generation error";
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
