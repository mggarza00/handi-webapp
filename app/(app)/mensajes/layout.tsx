/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReactNode } from "react";
import ChatList from "./_components/ChatList";
import type { ChatSummary } from "./_components/types";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/supabase";

export const dynamic = "force-dynamic";

async function getChatSummaries(): Promise<ChatSummary[]> {
  try {
    const hasEnv =
      !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!hasEnv) return [];
    const supabase = createServerComponentClient<Database>({ cookies });
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) return [];

    const { data: convs } = await supabase
      .from("conversations")
      .select("id, customer_id, pro_id, request_id, last_message_at")
      .or(`customer_id.eq.${user.id},pro_id.eq.${user.id}`)
      .order("last_message_at", { ascending: false });

    const proIds = Array.from(
      new Set(((convs || []).map((c) => c.pro_id)).filter(Boolean)),
    ) as string[];
    const proNames = new Map<string, string | null>();
    const proAvatars = new Map<string, string | null>();
    if (proIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", proIds);
      for (const p of profs || []) {
        proNames.set(p.id!, (p.full_name as string) || null);
        proAvatars.set(p.id!, (p.avatar_url as string) || null);
      }
    }

    const requestIds = Array.from(
      new Set(((convs || []).map((c) => (c as any).request_id)).filter(Boolean)),
    ) as string[];
    const requestTitles = new Map<string, string | null>();
    if (requestIds.length) {
      const { data: reqs } = await supabase
        .from("requests")
        .select("id, title")
        .in("id", requestIds);
      for (const r of reqs || []) {
        const title = typeof r.title === "string" ? r.title : null;
        requestTitles.set(r.id, title);
      }
    }

    const convIds = (convs || []).map((c) => c.id) as string[];
    const previews = new Map<
      string,
      { body: string; sender_id: string; created_at: string; read_by: string[] }
    >();
    if (convIds.length) {
      const { data: msgs } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, body, text, created_at, read_by")
        .in("conversation_id", convIds)
        .order("created_at", { ascending: false })
        .limit(Math.min(300, convIds.length * 3));
      for (const m of msgs || []) {
        const cid = (m as any).conversation_id as string;
        if (!previews.has(cid)) {
          previews.set(cid, {
            body: String(((m as any).body ?? (m as any).text ?? "") as string),
            sender_id: String((m as any).sender_id ?? ""),
            created_at: String((m as any).created_at ?? ""),
            read_by: Array.isArray((m as any).read_by)
              ? ((m as any).read_by as unknown[]).map((x) => String(x))
              : [],
          });
        }
      }
    }

    const items: ChatSummary[] = (convs || []).map((c) => {
      const proId = (c.pro_id as string | null) ?? null;
      const pv = previews.get(c.id!);
      const lastBody = pv?.body ?? null;
      const lastAt =
        (pv?.created_at as string) || ((c.last_message_at as string) || null);
      const unread = pv ? pv.sender_id !== user.id && !pv.read_by.includes(user.id) : false;
      const rawTitle = proId ? proNames.get(proId) : null;
      const fallbackTitle =
        proId ? `${proId.slice(0, 8)}...` : "El nombre del profesional";
      const title =
        rawTitle && rawTitle.trim().length > 0 ? rawTitle : fallbackTitle;
      const avatarUrl = proId ? proAvatars.get(proId) || null : null;
      const requestId = (c as any).request_id as string | null;
      const rawRequestTitle =
        requestId && requestTitles.has(requestId)
          ? requestTitles.get(requestId) ?? null
          : null;
      const requestTitle =
        rawRequestTitle && rawRequestTitle.trim().length > 0 ? rawRequestTitle : null;
      return {
        id: c.id!,
        title,
        preview: lastBody,
        lastMessageAt: lastAt,
        unread,
        avatarUrl,
        requestTitle,
      };
    });
    return items;
  } catch {
    // On any server error, return empty list to avoid aborting the Suspense boundary
    return [];
  }
}

export default async function MensajesLayout({ children }: { children: ReactNode }) {
  const chats = await getChatSummaries();
  return (
    <div className="mx-auto max-w-6xl p-4">
      <h1 className="text-xl font-semibold mb-3">Mensajes</h1>
      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4">
        <aside className="rounded border bg-white md:sticky md:top-4 md:h-[calc(100vh-8rem)] overflow-auto">
          {/* Sidebar chat list */}
          <ChatList chats={chats} />
        </aside>
        <main className="min-h-[50vh] rounded border bg-white overflow-hidden hidden md:block">
          {/* Right pane only visible on md+; on mobile, detail route "[id]" has its own layout */}
          {children}
        </main>
      </div>
    </div>
  );
}
/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/no-explicit-any */
