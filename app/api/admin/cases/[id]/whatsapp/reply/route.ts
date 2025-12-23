import { NextResponse } from "next/server";
import { z } from "zod";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/log-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  body_text: z.string().min(1).max(1000),
});

const WA_TOKEN = process.env.WHATSAPP_TOKEN;
const WA_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WA_VERSION = process.env.WHATSAPP_API_VERSION || "v20.0";

async function findThread(
  admin: ReturnType<typeof getAdminSupabase>,
  caseId: string,
  userId: string | null,
) {
  // 1) Buscar evento con thread_id
  const { data: latestEvent } = await admin
    .from("support_case_events")
    .select("metadata")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const metaThreadId = latestEvent?.metadata?.thread_id as string | undefined;
  if (metaThreadId) {
    const { data: thread } = await admin
      .from("whatsapp_threads")
      .select("*")
      .eq("id", metaThreadId)
      .maybeSingle();
    if (thread) return thread;
  }
  // 2) Buscar por user_id
  if (userId) {
    const { data: thread } = await admin
      .from("whatsapp_threads")
      .select("*")
      .eq("user_id", userId)
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (thread) return thread;
  }
  return null;
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;
  if (!WA_TOKEN || !WA_PHONE_ID) {
    return NextResponse.json(
      { ok: false, error: "WHATSAPP_NOT_CONFIGURED" },
      { status: 500, headers: JSONH },
    );
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "VALIDATION_ERROR", detail: parsed.error.flatten() },
      { status: 422, headers: JSONH },
    );
  }

  const admin = getAdminSupabase();
  const { data: supportCase } = await admin
    .from("support_cases")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (!supportCase) {
    return NextResponse.json(
      { ok: false, error: "NOT_FOUND" },
      { status: 404, headers: JSONH },
    );
  }

  const thread = await findThread(
    admin,
    params.id,
    supportCase.user_id as string | null,
  );
  if (!thread) {
    return NextResponse.json(
      { ok: false, error: "THREAD_NOT_FOUND" },
      { status: 404, headers: JSONH },
    );
  }

  const to = (thread.wa_id as string | null) || (thread.phone_e164 as string);
  const sendRes = await fetch(
    `https://graph.facebook.com/${WA_VERSION}/${WA_PHONE_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WA_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: parsed.data.body_text },
      }),
    },
  );

  if (!sendRes.ok) {
    const detail = await sendRes.text();
    return NextResponse.json(
      { ok: false, error: "WHATSAPP_SEND_FAILED", detail },
      { status: 502, headers: JSONH },
    );
  }

  const sentJson = (await sendRes.json().catch(() => ({}))) as {
    messages?: Array<{ id?: string }>;
  };
  const messageId = sentJson?.messages?.[0]?.id || null;
  const nowIso = new Date().toISOString();

  await admin.from("support_case_events").insert({
    case_id: params.id,
    kind: "message_out",
    channel: "whatsapp",
    author_type: "admin",
    author_id: gate.userId,
    body_text: parsed.data.body_text,
    metadata: { message_id: messageId, thread_id: thread.id, to },
  });
  await admin
    .from("support_cases")
    .update({ last_activity_at: nowIso })
    .eq("id", params.id);

  await logAudit({
    actorId: gate.userId,
    action: "SUPPORT_CASE_WA_REPLY",
    entity: "support_cases",
    entityId: params.id,
    meta: { thread_id: thread.id, message_id: messageId },
  });

  return NextResponse.json(
    { ok: true, message_id: messageId },
    { status: 200, headers: JSONH },
  );
}
