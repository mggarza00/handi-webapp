import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import {
  generateCampaignProposal,
  generateContentProposal,
} from "@/lib/campaigns/generation";
import {
  readRequestPayload,
  respondWithRedirectOrJson,
} from "@/lib/campaigns/http";
import {
  batchUpdateCampaigns,
  buildPersistInputFromCampaignProposal,
  createPersistedCampaignDraft,
  editCampaignMessage,
  regenerateCampaignMessage,
  updateCampaignWorkflowStatus,
} from "@/lib/campaigns/repository";
import { logAudit } from "@/lib/log-audit";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SEED_TAG = "[demo_seed_phase3]";

type SeedScenario = {
  input: Parameters<typeof generateCampaignProposal>[0];
  manualEdit?: {
    messageIndex: number;
    headline?: string;
    body?: string;
    cta?: string;
    note: string;
  };
  regeneration?: {
    messageIndex: number;
    note: string;
  };
  finalStatus?: "approved" | "rejected" | "changes_requested" | "archive";
  finalNote?: string;
};

function assertDevSeedAllowed() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ENABLE_DEV_SEED !== "1"
  ) {
    throw new Error("FORBIDDEN");
  }
}

function scenarios(): SeedScenario[] {
  return [
    {
      input: {
        title: "Seed: Clientes - confianza para limpieza profunda",
        audience: "client",
        goal: "acquisition",
        channels: ["meta", "landing"],
        serviceCategory: "Limpieza profunda",
        offer: "Encuentra ayuda confiable para dejar tu espacio en orden.",
        cta: "Solicita limpieza",
        journeyTrigger: "manual_admin_seed",
        tonePreference: "Clear, calm, and reassuring",
        notes: `${SEED_TAG} Focus on trust, home peace, and low-friction next steps.`,
      },
      manualEdit: {
        messageIndex: 0,
        headline: "Tu espacio en orden, sin complicarte",
        note: "Tighten the opening line and make the promise feel calmer.",
      },
    },
    {
      input: {
        title: "Seed: Pros - activa oportunidades verificadas",
        audience: "professional",
        goal: "activation",
        channels: ["whatsapp", "push", "email"],
        serviceCategory: "Plomeria y mantenimiento",
        offer:
          "Activa tu perfil y responde oportunidades con una imagen mas seria.",
        cta: "Activa tu perfil",
        journeyTrigger: "profile_incomplete",
        tonePreference: "Direct and useful",
        notes: `${SEED_TAG} Handi should sound practical, professional, and pro-trust.`,
      },
      regeneration: {
        messageIndex: 1,
        note: "Make this version more direct for pros who need a clear benefit fast.",
      },
      finalStatus: "approved",
      finalNote: "Ready for internal review signoff.",
    },
    {
      input: {
        title: "Seed: Clientes - vuelve cuando necesites resolver rapido",
        audience: "client",
        goal: "reactivation",
        channels: ["email", "push"],
        serviceCategory: "Electricista",
        offer: "Retoma Handi cuando necesites resolver algo sin vueltas.",
        cta: "Vuelve a Handi",
        journeyTrigger: "inactive_user_winback",
        tonePreference: "Friendly but restrained",
        notes: `${SEED_TAG} Avoid promo-heavy language and keep the tone credible.`,
      },
      finalStatus: "changes_requested",
      finalNote:
        "Need a stronger reason to return and a clearer trust hook before approval.",
    },
    {
      input: {
        title: "Seed: Pros - convierte mas leads serios",
        audience: "professional",
        goal: "conversion",
        channels: ["meta", "landing"],
        serviceCategory: "Instalaciones electricas",
        offer:
          "Convierte tu trabajo en mas oportunidades serias dentro de Handi.",
        cta: "Quiero mas oportunidades",
        journeyTrigger: "lead_capture_followup",
        tonePreference: "Professional with sharp clarity",
        notes: `${SEED_TAG} Keep the promise credible and avoid sounding exaggerated.`,
      },
      manualEdit: {
        messageIndex: 0,
        body: "Haz que tu trabajo llegue a clientes mas serios con una presentacion clara, confianza visible y una siguiente accion simple.",
        note: "Sharpen the body to sound more concrete and less generic.",
      },
      regeneration: {
        messageIndex: 1,
        note: "Try a broader value framing with more trust and less pressure.",
      },
      finalStatus: "rejected",
      finalNote:
        "Useful draft, but the angle still feels too broad for approval.",
    },
    {
      input: {
        title: "Seed: Clientes - landing para confianza inmediata",
        audience: "client",
        goal: "conversion",
        channels: ["landing"],
        serviceCategory: "Jardineria",
        offer: "Da el siguiente paso con una propuesta clara y confiable.",
        cta: "Ver como funciona",
        journeyTrigger: "manual_admin_seed",
        tonePreference: "Modern and calm",
        notes: `${SEED_TAG} Keep this as a simple archive example for filters and admin history.`,
      },
      finalStatus: "archive",
      finalNote: "Archived demo example for workflow validation.",
    },
  ];
}

async function seedCampaigns(createdBy: string | null) {
  const admin = getAdminSupabase();
  const createdIds: string[] = [];

  for (const scenario of scenarios()) {
    const proposal = await generateCampaignProposal(scenario.input);
    const persisted = await createPersistedCampaignDraft(
      buildPersistInputFromCampaignProposal({
        admin,
        createdBy,
        input: scenario.input,
        proposal,
      }),
    );
    createdIds.push(persisted.draft.id);

    await logAudit({
      actorId: createdBy,
      action: "CAMPAIGN_DRAFT_GENERATED",
      entity: "campaign_drafts",
      entityId: persisted.draft.id,
      meta: {
        title: scenario.input.title,
        audience: scenario.input.audience,
        goal: scenario.input.goal,
        channels: scenario.input.channels,
        seed: true,
      },
    });

    if (scenario.manualEdit) {
      const target = persisted.messages[scenario.manualEdit.messageIndex];
      if (target) {
        await editCampaignMessage({
          admin,
          messageId: target.id,
          createdBy,
          headline: scenario.manualEdit.headline,
          body: scenario.manualEdit.body,
          cta: scenario.manualEdit.cta,
          rationaleNote: scenario.manualEdit.note,
        });
        await logAudit({
          actorId: createdBy,
          action: "CAMPAIGN_MESSAGE_EDITED",
          entity: "campaign_messages",
          entityId: target.id,
          meta: {
            draftId: persisted.draft.id,
            note: scenario.manualEdit.note,
            seed: true,
          },
        });
      }
    }

    if (scenario.regeneration) {
      const target = persisted.messages[scenario.regeneration.messageIndex];
      if (target) {
        await regenerateCampaignMessage({
          admin,
          messageId: target.id,
          createdBy,
          feedbackNote: scenario.regeneration.note,
          generator: generateContentProposal,
        });
        await logAudit({
          actorId: createdBy,
          action: "CAMPAIGN_MESSAGE_REGENERATED",
          entity: "campaign_messages",
          entityId: target.id,
          meta: {
            draftId: persisted.draft.id,
            note: scenario.regeneration.note,
            seed: true,
          },
        });
      }
    }

    if (scenario.finalStatus === "approved") {
      await updateCampaignWorkflowStatus(admin, {
        campaignId: persisted.draft.id,
        status: "approved",
        feedbackType: "approve",
        feedbackNote: scenario.finalNote,
        createdBy,
      });
      await logAudit({
        actorId: createdBy,
        action: "CAMPAIGN_APPROVED",
        entity: "campaign_drafts",
        entityId: persisted.draft.id,
        meta: { note: scenario.finalNote, seed: true },
      });
    }

    if (scenario.finalStatus === "rejected") {
      await updateCampaignWorkflowStatus(admin, {
        campaignId: persisted.draft.id,
        status: "rejected",
        feedbackType: "reject",
        feedbackNote: scenario.finalNote,
        createdBy,
      });
      await logAudit({
        actorId: createdBy,
        action: "CAMPAIGN_REJECTED",
        entity: "campaign_drafts",
        entityId: persisted.draft.id,
        meta: { note: scenario.finalNote, seed: true },
      });
    }

    if (scenario.finalStatus === "changes_requested") {
      await updateCampaignWorkflowStatus(admin, {
        campaignId: persisted.draft.id,
        status: "changes_requested",
        feedbackType: "request_changes",
        feedbackNote: scenario.finalNote,
        createdBy,
      });
      await logAudit({
        actorId: createdBy,
        action: "CAMPAIGN_CHANGES_REQUESTED",
        entity: "campaign_drafts",
        entityId: persisted.draft.id,
        meta: { note: scenario.finalNote, seed: true },
      });
    }

    if (scenario.finalStatus === "archive") {
      await batchUpdateCampaigns(admin, {
        campaignIds: [persisted.draft.id],
        action: "archive",
        note: scenario.finalNote,
        createdBy,
      });
      await logAudit({
        actorId: createdBy,
        action: "CAMPAIGN_ARCHIVED",
        entity: "campaign_drafts",
        entityId: persisted.draft.id,
        meta: { note: scenario.finalNote, seed: true },
      });
    }
  }

  return createdIds;
}

async function resetSeedCampaigns() {
  const admin = getAdminSupabase();
  const { data: drafts, error } = await admin
    .from("campaign_drafts")
    .select("id")
    .ilike("title", "Seed:%");

  if (error) {
    throw new Error(error.message || "failed to load seeded campaigns");
  }

  const ids = (Array.isArray(drafts) ? drafts : [])
    .map((row) => (row as { id?: string }).id || "")
    .filter(Boolean);

  if (!ids.length) return [];

  const { error: deleteError } = await admin
    .from("campaign_drafts")
    .delete()
    .in("id", ids);

  if (deleteError) {
    throw new Error(deleteError.message || "failed to delete seeded campaigns");
  }

  return ids;
}

export async function POST(req: Request) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  try {
    assertDevSeedAllowed();

    const payload = await readRequestPayload(req);
    const redirectTo =
      typeof payload.redirectTo === "string" ? payload.redirectTo : null;
    const action = typeof payload.action === "string" ? payload.action : "seed";

    if (action === "reset") {
      const deletedIds = await resetSeedCampaigns();
      return respondWithRedirectOrJson({
        req,
        redirectTo: redirectTo || "/admin/campaigns",
        payload: { ok: true, action, deletedIds },
      });
    }

    const createdIds = await seedCampaigns(gate.userId);
    return respondWithRedirectOrJson({
      req,
      redirectTo: redirectTo || "/admin/campaigns",
      payload: { ok: true, action: "seed", createdIds },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed to seed campaigns";
    const status = message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json(
      { ok: false, error: "internal_error", detail: message },
      { status, headers: JSONH },
    );
  }
}
