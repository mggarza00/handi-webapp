import { NextResponse } from "next/server";
import { z } from "zod";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { generateCampaignProposal } from "@/lib/campaigns/generation";
import {
  readRequestPayload,
  respondWithRedirectOrJson,
} from "@/lib/campaigns/http";
import {
  buildPersistInputFromCampaignProposal,
  createPersistedCampaignDraft,
} from "@/lib/campaigns/repository";
import { campaignGenerationInputSchema } from "@/lib/ai/schemas";
import { logAudit } from "@/lib/log-audit";
import { getAdminSupabase } from "@/lib/supabase/server";

const FormSchema = z.object({
  title: z.string().optional(),
  sourceCampaignDraftId: z.string().uuid().optional(),
  audience: z.string(),
  goal: z.string(),
  channels: z.union([z.string(), z.array(z.string())]),
  serviceCategory: z.string(),
  offer: z.string(),
  cta: z.string(),
  journeyTrigger: z.string(),
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
    const channelsRaw = raw.channels;
    const channels = Array.isArray(channelsRaw)
      ? channelsRaw
      : typeof channelsRaw === "string"
        ? [channelsRaw]
        : [];
    const normalized = {
      title: raw.title,
      sourceCampaignDraftId: raw.sourceCampaignDraftId,
      audience: raw.audience,
      goal: raw.goal,
      channels,
      serviceCategory: raw.serviceCategory,
      offer: raw.offer,
      cta: raw.cta,
      journeyTrigger: raw.journeyTrigger,
      tonePreference: raw.tonePreference,
      notes: raw.notes,
    };

    const formParsed = FormSchema.safeParse({
      ...normalized,
      channels,
      redirectTo: raw.redirectTo,
    });
    const parsed = campaignGenerationInputSchema.safeParse(normalized);

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
    const proposal = await generateCampaignProposal(parsed.data);
    const persisted = await createPersistedCampaignDraft(
      buildPersistInputFromCampaignProposal({
        admin,
        createdBy: gate.userId,
        input: parsed.data,
        proposal,
      }),
    );

    await logAudit({
      actorId: gate.userId,
      action: "CAMPAIGN_DRAFT_GENERATED",
      entity: "campaign_drafts",
      entityId: persisted.draft.id,
      meta: {
        title: parsed.data.title || null,
        sourceCampaignDraftId: parsed.data.sourceCampaignDraftId || null,
        audience: parsed.data.audience,
        goal: parsed.data.goal,
        channels: parsed.data.channels,
        tonePreference: parsed.data.tonePreference || null,
        generationProvider: proposal.provider.activeProvider,
        generationProviderStatus: proposal.provider.status,
        generationMode: proposal.provider.generationMode,
        generationModel: proposal.provider.model,
        generationFallbackReason: proposal.provider.fallbackReason,
        generationRequestId: proposal.provider.requestId,
        sourceCampaignTitle:
          typeof raw.sourceCampaignTitle === "string"
            ? raw.sourceCampaignTitle
            : null,
      },
    });

    if (parsed.data.sourceCampaignDraftId) {
      await logAudit({
        actorId: gate.userId,
        action: "CAMPAIGN_DUPLICATED",
        entity: "campaign_drafts",
        entityId: persisted.draft.id,
        meta: {
          sourceCampaignDraftId: parsed.data.sourceCampaignDraftId,
          sourceCampaignTitle:
            typeof raw.sourceCampaignTitle === "string"
              ? raw.sourceCampaignTitle
              : null,
        },
      });
    }

    return respondWithRedirectOrJson({
      req,
      redirectTo:
        formParsed.data.redirectTo || `/admin/campaigns/${persisted.draft.id}`,
      payload: {
        ok: true,
        draftId: persisted.draft.id,
        messageIds: persisted.messages.map((message) => message.id),
        campaignDraft: persisted.draft,
        channelPlan: proposal.channelPlan,
        messageSuggestions: persisted.messages,
        kpiSuggestions: proposal.kpiSuggestions,
        rationaleSummary: proposal.rationaleSummary,
        provider: proposal.provider,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "unknown campaign generation error";
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
