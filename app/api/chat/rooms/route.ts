/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getUserFromRequestOrThrow, getDbClientForRequest, getDevUserFromHeader } from "@/lib/auth-route";
import { createServerClient as createServiceClient } from "@/lib/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function GET(req: Request) {
  try {
    let usedDev = false;
    const result = await getDevUserFromHeader(req);
    let user = result?.user as any;
    if (!user) {
      try {
        ({ user } = await getUserFromRequestOrThrow(req));
      } catch (e) {
        // Unauthenticated: return empty list instead of 401 to avoid UX break
        const status = (e as any)?.status;
        if (status === 401) {
          return NextResponse.json({ ok: true, data: [] }, { status: 200, headers: JSONH });
        }
        throw e;
      }
    } else {
      usedDev = true;
    }

    const db: any = usedDev ? createServiceClient() : await getDbClientForRequest(req);

    const { data: convs, error: convErr } = await db
      .from("conversations")
      .select("id, customer_id, pro_id, last_message_at")
      .or(`customer_id.eq.${user.id},pro_id.eq.${user.id}`)
      .order("last_message_at", { ascending: false });
    if (convErr) throw convErr;

    const peerIds = Array.from(new Set((convs || []).map((c: any) => (c.customer_id === user.id ? c.pro_id : c.customer_id))));
    const names = new Map<string, string | null>();
    const avatars = new Map<string, string | null>();
    if (peerIds.length) {
      const { data: profs } = await db.from("profiles").select("id, full_name, avatar_url").in("id", peerIds);
      for (const p of profs || []) {
        names.set(p.id, p.full_name ?? null);
        avatars.set(p.id, p.avatar_url ?? null);
      }
    }

    const convIds = (convs || []).map((c: any) => c.id);
    const previews = new Map<string, { body: string; sender_id: string; created_at: string; read_by: string[] }>();
    if (convIds.length) {
      const { data: msgs } = await db
        .from("messages")
        .select("id, conversation_id, sender_id, body, text, created_at, read_by")
        .in("conversation_id", convIds)
        .order("created_at", { ascending: false })
        .limit(Math.min(300, convIds.length * 3));
      for (const m of msgs || []) {
        const cid = m.conversation_id as string;
        const bodyStr = String((m.body ?? m.text ?? "") as string).trim();
        const isLongPayment = /el pago está en custodia/i.test(bodyStr);
        if (isLongPayment) continue;
        if (!previews.has(cid)) {
          previews.set(cid, {
            body: bodyStr,
            sender_id: String(m.sender_id ?? ""),
            created_at: String(m.created_at ?? ""),
            read_by: Array.isArray(m.read_by) ? (m.read_by as unknown[]).map((x) => String(x)) : [],
          });
        }
      }
    }

    const items = (convs || []).map((c: any) => {
      const peer = c.customer_id === user.id ? c.pro_id : c.customer_id;
      const pv = previews.get(c.id);
      const lastBody = pv?.body ?? null;
      const lastAt = pv?.created_at || c.last_message_at || null;
      const unreadCount = pv ? (pv.sender_id !== user.id && !pv.read_by.includes(user.id) ? 1 : 0) : 0; // simple heuristic
      return {
        id: c.id,
        title: names.get(peer) || `${String(peer).slice(0, 8)}…`,
        avatarUrl: avatars.get(peer) || null,
        lastMessagePreview: lastBody,
        lastMessageTime: lastAt,
        unreadCount,
      };
    });

    return NextResponse.json({ ok: true, data: items }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "INTERNAL_ERROR";
    const anyE = e as any;
    const status = typeof anyE?.status === "number" ? anyE.status : 500;
    return NextResponse.json({ ok: false, error: msg }, { status, headers: JSONH });
  }
}
/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable prefer-const */
