import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import {
  createCampaignInternalNote,
  listCampaignInternalNotes,
} from "@/lib/campaigns/repository";
import {
  readRequestPayload,
  respondWithRedirectOrJson,
} from "@/lib/campaigns/http";
import { logAudit } from "@/lib/log-audit";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  try {
    const admin = getAdminSupabase();
    const notes = await listCampaignInternalNotes(admin, params.id);
    return NextResponse.json({ ok: true, notes }, { headers: JSONH });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed to list notes";
    return NextResponse.json(
      { ok: false, error: "internal_error", detail: message },
      { status: 500, headers: JSONH },
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  try {
    const payload = await readRequestPayload(req);
    const note =
      typeof payload.note === "string"
        ? payload.note
        : typeof payload.feedback_note === "string"
          ? payload.feedback_note
          : "";
    const redirectTo =
      typeof payload.redirectTo === "string" ? payload.redirectTo : null;

    if (!note.trim()) {
      return NextResponse.json(
        { ok: false, error: "note_required" },
        { status: 422, headers: JSONH },
      );
    }

    const admin = getAdminSupabase();
    const createdNote = await createCampaignInternalNote({
      admin,
      campaignId: params.id,
      note: note.trim(),
      createdBy: gate.userId,
    });

    await logAudit({
      actorId: gate.userId,
      action: "CAMPAIGN_INTERNAL_NOTE_ADDED",
      entity: "campaign_drafts",
      entityId: params.id,
      meta: { note: createdNote.note },
    });

    return respondWithRedirectOrJson({
      req,
      redirectTo: redirectTo || `/admin/campaigns/${params.id}`,
      payload: { ok: true, note: createdNote },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed to create note";
    return NextResponse.json(
      { ok: false, error: "internal_error", detail: message },
      { status: 500, headers: JSONH },
    );
  }
}
