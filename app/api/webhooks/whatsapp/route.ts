import crypto from "node:crypto";
import { NextResponse } from "next/server";

import { JSONH } from "@/lib/auth-admin";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { computeSlaDueAt } from "@/lib/support/sla";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const APP_SECRET = process.env.WHATSAPP_APP_SECRET;

function verifySignature(req: Request, raw: string): boolean {
  if (!APP_SECRET) return true;
  const sig = req.headers.get("x-hub-signature-256") || "";
  const expected = `sha256=${crypto.createHmac("sha256", APP_SECRET).update(raw, "utf8").digest("hex")}`;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === VERIFY_TOKEN && challenge) {
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return NextResponse.json(
    { ok: false, error: "INVALID_CHALLENGE" },
    { status: 403, headers: JSONH },
  );
}

type CloudEntry = {
  id: string;
  changes: Array<{
    value?: {
      metadata?: { phone_number_id?: string; display_phone_number?: string };
      messages?: Array<{
        id: string;
        from: string;
        timestamp?: string;
        text?: { body?: string };
        type: string;
      }>;
    };
  }>;
};

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifySignature(req, raw)) {
    return NextResponse.json(
      { ok: false, error: "BAD_SIGNATURE" },
      { status: 401, headers: JSONH },
    );
  }

  const payload = (() => {
    try {
      return JSON.parse(raw) as { entry?: CloudEntry[] };
    } catch {
      return null;
    }
  })();
  if (!payload?.entry?.length) {
    return NextResponse.json({ ok: true }, { status: 200, headers: JSONH });
  }

  const admin = getAdminSupabase();
  for (const entry of payload.entry) {
    const change = entry?.changes?.[0];
    const msg = change?.value?.messages?.[0];
    if (!msg) continue;
    const phone = msg.from;
    const body = msg.text?.body ?? "";
    const wa_id = msg.id;
    const tsMs = msg.timestamp
      ? parseInt(msg.timestamp, 10) * 1000
      : Date.now();
    const createdAtIso = new Date(tsMs).toISOString();

    // Upsert thread
    const { data: thread } = await admin
      .from("whatsapp_threads")
      .upsert(
        { phone_e164: phone, last_message_at: createdAtIso },
        { onConflict: "phone_e164" },
      )
      .select()
      .maybeSingle();

    let userId: string | null = null;
    try {
      const profile = await admin
        .from("profiles")
        .select("id, phone")
        .eq("phone", phone)
        .maybeSingle();
      userId = (profile?.data as { id?: string } | null)?.id ?? null;
    } catch {
      userId = null;
    }

    // Find open case
    let query = admin
      .from("support_cases")
      .select("*")
      .not("status", "in", "(resuelto,cerrado)")
      .order("last_activity_at", { ascending: false })
      .limit(1);
    if (userId) {
      query = query.eq("user_id", userId);
    } else {
      query = query.eq("channel_origin", "whatsapp");
    }
    const { data: openCase } = await query.maybeSingle();

    let caseId = openCase?.id as string | null;
    if (!caseId) {
      const priority = "media";
      const insertRes = await admin
        .from("support_cases")
        .insert({
          user_id: userId,
          channel_origin: "whatsapp",
          priority,
          status: "nuevo",
          last_activity_at: createdAtIso,
          sla_due_at: computeSlaDueAt(priority).toISOString(),
          subject: body ? body.slice(0, 120) : "Nuevo mensaje WhatsApp",
        })
        .select()
        .maybeSingle();
      caseId = insertRes.data?.id ?? null;
    } else {
      await admin
        .from("support_cases")
        .update({ last_activity_at: createdAtIso })
        .eq("id", caseId);
    }

    if (caseId) {
      await admin.from("support_case_events").insert({
        case_id: caseId,
        kind: "message_in",
        channel: "whatsapp",
        author_type: "customer",
        author_id: userId,
        body_text: body,
        metadata: { wa_id, phone, thread_id: thread?.id ?? null },
        created_at: createdAtIso,
      });
    }
  }

  return NextResponse.json({ ok: true }, { status: 200, headers: JSONH });
}
