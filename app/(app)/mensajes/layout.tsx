/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReactNode } from "react";
import MessagesShell from "./_components/MessagesShell.client";
import RealtimeProvider from "@/components/messages/RealtimeProvider";
import type { ChatSummary } from "./_components/types";
import { cookies } from "next/headers";
import createClient from "@/utils/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { createClient as createSupabaseJs } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

export const dynamic = "force-dynamic";

async function getChatSummaries(): Promise<ChatSummary[]> {
  try {
    const hasEnv =
      !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!hasEnv) return [];
    const supabase = createClient() as any;
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) {
      // Dev/E2E fallback: if no SSR auth cookie, try e2e_session cookie + Service Role
      try {
        const cookieStore = cookies();
        const raw = cookieStore.get("e2e_session")?.value || "";
        const decoded = raw ? decodeURIComponent(raw) : "";
        const email = decoded.split(":")[0] || "";
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
        if (!email || !url || !key) return [];
        const admin = createSupabaseJs<Database>(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        // Find user id by email (paginate best-effort)
        let userId: string | null = null;
        try {
          const perPage = 200;
          for (let page = 1; page <= 10 && !userId; page++) {
            const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
            if (error) break;
            const users = (data?.users ?? []) as Array<{ id: string; email?: string | null }>;
            const match = users.find((u) => (u.email || "").toLowerCase() === email.toLowerCase());
            if (match) userId = match.id;
            if (!users.length || users.length < perPage) break;
          }
        } catch {
          // ignore
        }
        if (!userId) return [];

        const { data: convs } = await admin
          .from("conversations")
          .select("id, customer_id, pro_id, request_id, last_message_at")
          .or(`customer_id.eq.${userId},pro_id.eq.${userId}`)
          .order("last_message_at", { ascending: false });

        const otherIds = Array.from(
          new Set(
            ((convs || [])
              .map((c) => {
                const proId = (c as any).pro_id as string | null;
                const custId = (c as any).customer_id as string | null;
                if (userId && proId === userId) return custId;
                if (userId && custId === userId) return proId;
                return null;
              })
              .filter(Boolean)) as string[],
          ),
        );
        const otherNames = new Map<string, string | null>();
        const otherAvatars = new Map<string, string | null>();
        if (otherIds.length) {
          const [{ data: profs }, { data: pros }] = await Promise.all([
            admin.from("profiles").select("id, full_name, avatar_url").in("id", otherIds),
            admin.from("professionals").select("id, full_name, avatar_url").in("id", otherIds),
          ]);
          for (const p of profs || []) {
            otherNames.set((p as any).id, ((p as any).full_name as string) || null);
            otherAvatars.set((p as any).id, ((p as any).avatar_url as string) || null);
          }
          for (const p of pros || []) {
            const id = (p as any).id as string;
            otherNames.set(id, ((p as any).full_name as string) || otherNames.get(id) || null);
            otherAvatars.set(id, ((p as any).avatar_url as string) || otherAvatars.get(id) || null);
          }
        }

        const requestIds = Array.from(
          new Set(((convs || []).map((c) => (c as any).request_id)).filter(Boolean)),
        ) as string[];
        const requestTitles = new Map<string, string | null>();
        if (requestIds.length) {
          const { data: reqs } = await admin
            .from("requests")
            .select("id, title")
            .in("id", requestIds);
          for (const r of reqs || []) {
            const id = (r as any).id as string;
            const title = typeof (r as any).title === "string" ? ((r as any).title as string) : null;
            requestTitles.set(id, title);
          }
        }

        const convIds = (convs || []).map((c) => (c as any).id) as string[];
        const previews = new Map<
          string,
          { body: string; sender_id: string; created_at: string; read_by: string[] }
        >();
        if (convIds.length) {
          const { data: msgs } = await admin
            .from("messages")
            .select("id, conversation_id, sender_id, body, text, created_at, read_by")
            .in("conversation_id", convIds)
            .order("created_at", { ascending: false })
            .limit(Math.min(300, convIds.length * 3));
          for (const m of msgs || []) {
            const cid = ((m as any).conversation_id ?? "") as string;
            const bodyStr = String(((m as any).body ?? (m as any).text ?? "") as string).trim();
            const isLongPayment = /el pago está en custodia/i.test(bodyStr);
            if (isLongPayment) continue;
            if (!previews.has(cid)) {
              previews.set(cid, {
                body: bodyStr,
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
          const proId = ((c as any).pro_id as string | null) ?? null;
          const custId = ((c as any).customer_id as string | null) ?? null;
          const otherId = userId === proId ? custId : userId === custId ? proId : null;
          const pv = previews.get((c as any).id as string);
          const lastBody = pv?.body ?? null;
          const lastAt = (pv?.created_at as string) || (((c as any).last_message_at as string) || null);
          const unread = pv ? pv.sender_id !== userId && !pv.read_by.includes(userId) : false;
          const rawTitle = otherId ? otherNames.get(otherId) : null;
          const fallbackTitle = "Contacto";
          const title = rawTitle && rawTitle.trim().length > 0 ? rawTitle : fallbackTitle;
          const avatarUrl = otherId ? otherAvatars.get(otherId) || null : null;
          const requestId = ((c as any).request_id as string | null) ?? null;
          const rawRequestTitle = requestId && requestTitles.has(requestId) ? requestTitles.get(requestId) ?? null : null;
          const requestTitle = rawRequestTitle && rawRequestTitle.trim().length > 0 ? rawRequestTitle : null;
          return {
            id: (c as any).id as string,
            title,
            preview: requestTitle ?? lastBody,
            lastMessageAt: lastAt,
            unread,
            avatarUrl,
            requestTitle,
          };
        });
        return items;
      } catch {
        return [];
      }
    }

    const { data: convs } = await supabase
      .from("conversations")
      .select("id, customer_id, pro_id, request_id, last_message_at")
      .or(`customer_id.eq.${user.id},pro_id.eq.${user.id}`)
      .order("last_message_at", { ascending: false });

    // Determinar el otro participante por conversacin
    const otherIds = Array.from(
      new Set(
        ((convs || [])
          .map((c) => {
            const proId = (c as any).pro_id as string | null;
            const custId = (c as any).customer_id as string | null;
            if (user.id && proId === user.id) return custId;
            if (user.id && custId === user.id) return proId;
            return null;
          })
          .filter(Boolean)) as string[],
      ),
    );
    const otherNames = new Map<string, string | null>();
    const otherAvatars = new Map<string, string | null>();
    if (otherIds.length) {
      // Carga perfiles genéricos
      const [{ data: profs }, { data: pros }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, avatar_url").in("id", otherIds),
        supabase.from("professionals").select("id, full_name, avatar_url").in("id", otherIds),
      ]);
      for (const p of profs || []) {
        otherNames.set(p.id!, (p.full_name as string) || null);
        otherAvatars.set(p.id!, (p.avatar_url as string) || null);
      }
      // Si existe un registro en professionals, preferir sus valores (suelen estar más completos)
      for (const p of pros || []) {
        otherNames.set(p.id!, (p.full_name as string) || otherNames.get(p.id!) || null);
        otherAvatars.set(p.id!, (p.avatar_url as string) || otherAvatars.get(p.id!) || null);
      }
      // Si faltan nombres/avatares por RLS, intenta con admin (solo servidor)
      const missing = otherIds.filter((id) => !otherNames.get(id));
      if (missing.length && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        try {
          const admin = getAdminSupabase();
          const [{ data: profs2 }, { data: pros2 }] = await Promise.all([
            admin.from("profiles").select("id, full_name, avatar_url").in("id", missing),
            admin.from("professionals").select("id, full_name, avatar_url").in("id", missing),
          ]);
          for (const p of profs2 || []) {
            const id = (p as any).id as string;
            otherNames.set(id, ((p as any).full_name as string) || otherNames.get(id) || null);
            otherAvatars.set(id, ((p as any).avatar_url as string) || otherAvatars.get(id) || null);
          }
          for (const p of pros2 || []) {
            const id = (p as any).id as string;
            otherNames.set(id, ((p as any).full_name as string) || otherNames.get(id) || null);
            otherAvatars.set(id, ((p as any).avatar_url as string) || otherAvatars.get(id) || null);
          }
        } catch {
          // ignore
        }
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
        const bodyStr = String(((m as any).body ?? (m as any).text ?? "") as string).trim();
        const isLongPayment = /el pago está en custodia/i.test(bodyStr);
        if (isLongPayment) continue;
        if (!previews.has(cid)) {
          previews.set(cid, {
            body: bodyStr,
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
      const custId = (c.customer_id as string | null) ?? null;
      const otherId = user.id === proId ? custId : user.id === custId ? proId : null;
      const pv = previews.get(c.id!);
      const lastBody = pv?.body ?? null;
      const lastAt =
        (pv?.created_at as string) || ((c.last_message_at as string) || null);
      const unread = pv ? pv.sender_id !== user.id && !pv.read_by.includes(user.id) : false;
      const rawTitle = otherId ? otherNames.get(otherId) : null;
      const fallbackTitle = "Contacto";
      const title = rawTitle && rawTitle.trim().length > 0 ? rawTitle : fallbackTitle;
      const avatarUrl = otherId ? otherAvatars.get(otherId) || null : null;
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
        // Mostrar el nombre de la solicitud como preview en el listado de chats
        preview: requestTitle ?? lastBody,
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
    <RealtimeProvider>
      <MessagesShell chats={chats}>{children}</MessagesShell>
    </RealtimeProvider>
  );
}
/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/no-explicit-any */
