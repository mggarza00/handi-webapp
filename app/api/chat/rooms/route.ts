/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import {
  getUserFromRequestOrThrow,
  getDbClientForRequest,
  getDevUserFromHeader,
} from "@/lib/auth-route";
import { createServerClient as createServiceClient } from "@/lib/supabase";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;
const CACHEH = {
  ...JSONH,
  "Cache-Control": "private, max-age=10, stale-while-revalidate=30",
} as const;
const MAINTENANCE = process.env.MAINTENANCE_MODE === "true";
const LOG_TIMING = process.env.LOG_TIMING === "1";

export async function GET(req: Request) {
  const t0 = Date.now();
  try {
    if (MAINTENANCE) {
      return NextResponse.json(
        { ok: false, maintenance: true },
        { status: 503, headers: { ...JSONH, "Cache-Control": "no-store" } },
      );
    }
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
          return NextResponse.json(
            { ok: true, data: [] },
            { status: 200, headers: CACHEH },
          );
        }
        throw e;
      }
    } else {
      usedDev = true;
    }

    const db: any = usedDev
      ? createServiceClient()
      : await getDbClientForRequest(req);

    const ip = getClientIp(req);
    const limiterKey = `chat-rooms:${user?.id || ip}`;
    const limit = checkRateLimit(limiterKey, 20, 60_000);
    if (!limit.allowed) {
      return NextResponse.json(
        { ok: false, error: "RATE_LIMITED" },
        {
          status: 429,
          headers: {
            ...JSONH,
            "Cache-Control": "no-store",
            "Retry-After": Math.ceil(limit.resetMs / 1000).toString(),
          },
        },
      );
    }

    const url = new URL(req.url);
    const rawLimit = Number(url.searchParams.get("limit") || "50");
    const maxRooms = Math.min(
      50,
      Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 50),
    );

    const { data: convs, error: convErr } = await db
      .from("conversations")
      .select("id, customer_id, pro_id, last_message_at")
      .or(`customer_id.eq.${user.id},pro_id.eq.${user.id}`)
      .order("last_message_at", { ascending: false })
      .range(0, maxRooms - 1);
    if (convErr) throw convErr;

    const peerIds = Array.from(
      new Set(
        (convs || []).map((c: any) =>
          c.customer_id === user.id ? c.pro_id : c.customer_id,
        ),
      ),
    );
    const names = new Map<string, string | null>();
    const avatars = new Map<string, string | null>();
    if (peerIds.length) {
      const { data: profs } = await db
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", peerIds);
      for (const p of profs || []) {
        names.set(p.id, p.full_name ?? null);
        avatars.set(p.id, p.avatar_url ?? null);
      }
    }

    const convIds = (convs || []).map((c: any) => c.id);
    const previews = new Map<
      string,
      { body: string; sender_id: string; created_at: string; read_by: string[] }
    >();
    if (convIds.length) {
      const { data: msgs } = await db
        .from("messages")
        .select("id, conversation_id, sender_id, body, text, created_at, read_by")
        .in("conversation_id", convIds)
        .order("created_at", { ascending: false })
        .limit(Math.min(120, convIds.length * 2));
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

    return NextResponse.json(
      { ok: true, data: items },
      { status: 200, headers: CACHEH },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "INTERNAL_ERROR";
    const anyE = e as any;
    const status = typeof anyE?.status === "number" ? anyE.status : 500;
    return NextResponse.json(
      { ok: false, error: msg },
      { status, headers: JSONH },
    );
  } finally {
    if (LOG_TIMING) {
      // eslint-disable-next-line no-console
      console.info("[timing] /api/chat/rooms", {
        ms: Date.now() - t0,
      });
    }
  }
}
/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable prefer-const */
