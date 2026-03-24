"use client";

import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Trash2 } from "lucide-react";

import ChatListItem from "./ChatListItem";
import type { ChatSummary } from "./types";

import ChatListRealtime, {
  type MessagePayload,
} from "@/components/messages/ChatListRealtime";
import {
  hasUsableAvatar,
  isPlaceholderChatTitle,
  pickBetterChatIdentity,
} from "@/lib/chat/chat-identity";
import { supabaseBrowser } from "@/lib/supabase-browser";

type ChatRoomsApiItem = {
  id: string | number;
  title?: string | null;
  lastMessagePreview?: string | null;
  lastMessageTime?: string | null;
  unreadCount?: number | null;
  avatarUrl?: string | null;
};

type ProfileIdentity = {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  lastActiveAt: string | null;
};

export default function ChatList({ chats }: { chats: ChatSummary[] }) {
  const initial = useMemo(() => (Array.isArray(chats) ? chats : []), [chats]);
  const [items, setItems] = useState<ChatSummary[]>(initial);
  const [editing, setEditing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const itemsRef = useRef<ChatSummary[]>(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const [typingMap, setTypingMap] = useState<Record<string, boolean>>({});
  const profileCacheRef = useRef<Map<string, ProfileIdentity>>(new Map());
  const conversationPeerRef = useRef<Map<string, string>>(new Map());
  const profileFetchInFlightRef = useRef<
    Map<string, Promise<ProfileIdentity | null>>
  >(new Map());
  const conversationHydrationInFlightRef = useRef<Map<string, Promise<void>>>(
    new Map(),
  );
  const lastConversationHydrationAttemptRef = useRef<Map<string, number>>(
    new Map(),
  );
  const roomsRevalidatedByConversationRef = useRef<Set<string>>(new Set());
  const roomsReloadInFlightRef = useRef(false);
  const lastRoomsReloadAtRef = useRef(0);
  const channelKey = useMemo(() => {
    if (!items.length) return "";
    const ids = Array.from(new Set(items.map((chat) => chat.id))).filter(
      Boolean,
    );
    if (!ids.length) return "";
    ids.sort();
    return ids.join("|");
  }, [items]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const pathname = usePathname() || "";
  const activeId = React.useMemo(() => {
    const m = pathname.match(/\/mensajes\/([^/?#]+)/i);
    return m ? m[1] : null;
  }, [pathname]);
  const activeIdRef = useRef<string | null>(activeId);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);
  const [meId, setMeId] = useState<string | null>(null);
  const meIdRef = useRef<string | null>(null);
  useEffect(() => {
    meIdRef.current = meId;
  }, [meId]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/me", {
          cache: "no-store",
          credentials: "include",
        });
        const j = await r.json().catch(() => ({}));
        if (!cancelled && r.ok && j?.user?.id) setMeId(String(j.user.id));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setItems(initial);
  }, [initial]);

  useEffect(() => {
    if (!channelKey) {
      setTypingMap({});
      return () => undefined;
    }
    const sb = supabaseBrowser;
    const channels: ReturnType<typeof sb.channel>[] = [];
    const timeouts = new Map<string, ReturnType<typeof setTimeout>>();
    const ids = channelKey.split("|").filter(Boolean);
    setTypingMap((prev) => {
      if (!Object.keys(prev).length) return prev;
      const next: Record<string, boolean> = {};
      for (const id of ids) {
        if (prev[id]) next[id] = true;
      }
      const prevKeys = Object.keys(prev);
      if (
        prevKeys.length === Object.keys(next).length &&
        prevKeys.every((key) => next[key])
      ) {
        return prev;
      }
      return next;
    });
    for (const id of ids) {
      const channel = sb
        .channel(`messages:${id}`)
        .on("broadcast", { event: "typing" }, () => {
          try {
            setTypingMap((prev) => {
              if (prev[id]) return prev;
              return { ...prev, [id]: true };
            });
            const existing = timeouts.get(id);
            if (existing) clearTimeout(existing);
            const timeout = setTimeout(() => {
              timeouts.delete(id);
              setTypingMap((prev) => {
                if (!prev[id]) return prev;
                const next = { ...prev };
                delete next[id];
                return next;
              });
            }, 3000);
            timeouts.set(id, timeout);
          } catch {
            /* ignore */
          }
        })
        .subscribe();
      channels.push(channel);
    }
    return () => {
      const idsToClear = Array.from(timeouts.keys());
      timeouts.forEach((timeout) => clearTimeout(timeout));
      timeouts.clear();
      if (idsToClear.length) {
        setTypingMap((prev) => {
          let changed = false;
          const next = { ...prev };
          for (const id of idsToClear) {
            if (next[id]) {
              delete next[id];
              changed = true;
            }
          }
          return changed ? next : prev;
        });
      }
      for (const channel of channels) {
        try {
          sb.removeChannel(channel);
        } catch {
          /* ignore */
        }
      }
    };
  }, [channelKey]);

  // Client-side fallback: if SSR provided no chats (env or cookie missing), load via API
  useEffect(() => {
    if (initial.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/chat/rooms", {
          credentials: "include",
          cache: "no-store",
        });
        const j = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && Array.isArray(j?.data)) {
          const mapped: ChatSummary[] = (j.data as ChatRoomsApiItem[]).map(
            (it) => {
              const identity = pickBetterChatIdentity(
                {},
                { title: it.title, avatarUrl: it.avatarUrl },
              );
              return {
                id: String(it.id),
                title: identity.title || "Contacto",
                preview:
                  typeof it.lastMessagePreview === "string"
                    ? it.lastMessagePreview
                    : null,
                lastMessageAt:
                  typeof it.lastMessageTime === "string"
                    ? it.lastMessageTime
                    : null,
                unread:
                  typeof it.unreadCount === "number"
                    ? it.unreadCount > 0
                    : false,
                avatarUrl: identity.avatarUrl,
                requestTitle: null,
                unreadCount:
                  typeof it.unreadCount === "number" ? it.unreadCount : 0,
                otherLastActiveAt: null,
              };
            },
          );
          setItems(mapped);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initial.length]);

  const revalidateRoomsBestEffort = React.useCallback(async () => {
    const now = Date.now();
    if (roomsReloadInFlightRef.current) return;
    if (now - lastRoomsReloadAtRef.current < 2500) return;
    roomsReloadInFlightRef.current = true;
    lastRoomsReloadAtRef.current = now;
    try {
      const res = await fetch("/api/chat/rooms", {
        credentials: "include",
        cache: "no-store",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(j?.data)) return;
      const incoming: ChatSummary[] = (j.data as ChatRoomsApiItem[]).map(
        (it) => {
          const identity = pickBetterChatIdentity(
            {},
            { title: it.title, avatarUrl: it.avatarUrl },
          );
          return {
            id: String(it.id),
            title: identity.title || "Contacto",
            preview:
              typeof it.lastMessagePreview === "string"
                ? it.lastMessagePreview
                : null,
            lastMessageAt:
              typeof it.lastMessageTime === "string"
                ? it.lastMessageTime
                : null,
            unread:
              typeof it.unreadCount === "number" ? it.unreadCount > 0 : false,
            avatarUrl: identity.avatarUrl,
            requestTitle: null,
            unreadCount:
              typeof it.unreadCount === "number" ? it.unreadCount : 0,
            otherLastActiveAt: null,
          };
        },
      );
      setItems((prev) => {
        const map = new Map<string, ChatSummary>();
        for (const row of prev) map.set(row.id, row);
        for (const row of incoming) {
          const existing = map.get(row.id);
          if (!existing) {
            map.set(row.id, row);
            continue;
          }
          const identity = pickBetterChatIdentity(
            {
              title: existing.title,
              avatarUrl: existing.avatarUrl,
              otherLastActiveAt: existing.otherLastActiveAt,
            },
            {
              title: row.title,
              avatarUrl: row.avatarUrl,
              otherLastActiveAt: row.otherLastActiveAt,
            },
          );
          map.set(row.id, {
            ...existing,
            ...row,
            title: identity.title || existing.title || "Contacto",
            avatarUrl: identity.avatarUrl,
            otherLastActiveAt: identity.otherLastActiveAt,
            preview: row.preview ?? existing.preview ?? null,
            lastMessageAt: row.lastMessageAt ?? existing.lastMessageAt ?? null,
            unreadCount:
              typeof row.unreadCount === "number"
                ? row.unreadCount
                : existing.unreadCount,
            unread:
              typeof row.unread === "boolean" ? row.unread : existing.unread,
          });
        }
        return Array.from(map.values()).sort((a, b) => {
          const ta = new Date(a.lastMessageAt || 0).getTime();
          const tb = new Date(b.lastMessageAt || 0).getTime();
          return tb - ta;
        });
      });
    } catch {
      /* ignore */
    } finally {
      roomsReloadInFlightRef.current = false;
    }
  }, []);

  const fetchProfileIdentity = React.useCallback(async (userId: string) => {
    const normalizedId = userId.trim();
    if (!normalizedId) return null;
    const cached = profileCacheRef.current.get(normalizedId);
    if (cached) return cached;
    const inFlight = profileFetchInFlightRef.current.get(normalizedId);
    if (inFlight) return inFlight;
    const task = (async (): Promise<ProfileIdentity | null> => {
      try {
        const rp = await fetch(
          `/api/profiles/${encodeURIComponent(normalizedId)}`,
          {
            credentials: "include",
            cache: "no-store",
          },
        );
        const pj = await rp.json().catch(() => ({}));
        if (!pj?.data) return null;
        const name =
          typeof pj.data.full_name === "string" ? pj.data.full_name.trim() : "";
        const avatar =
          typeof pj.data.avatar_url === "string"
            ? pj.data.avatar_url.trim()
            : "";
        const identity: ProfileIdentity = {
          id: normalizedId,
          name: name || null,
          avatarUrl: avatar || null,
          lastActiveAt:
            typeof pj.data.last_active_at === "string"
              ? pj.data.last_active_at
              : null,
        };
        profileCacheRef.current.set(normalizedId, identity);
        return identity;
      } catch {
        return null;
      } finally {
        profileFetchInFlightRef.current.delete(normalizedId);
      }
    })();
    profileFetchInFlightRef.current.set(normalizedId, task);
    return task;
  }, []);

  const applyIdentityToConversation = React.useCallback(
    (cid: string, identity: Partial<ProfileIdentity>) => {
      setItems((curr) =>
        curr.map((c) => {
          if (c.id !== cid) return c;
          const merged = pickBetterChatIdentity(
            {
              title: c.title,
              avatarUrl: c.avatarUrl,
              otherLastActiveAt: c.otherLastActiveAt,
            },
            {
              title: identity.name,
              avatarUrl: identity.avatarUrl,
              otherLastActiveAt: identity.lastActiveAt,
            },
          );
          return {
            ...c,
            title: merged.title || c.title || "Contacto",
            avatarUrl: merged.avatarUrl,
            otherLastActiveAt: merged.otherLastActiveAt,
          };
        }),
      );
    },
    [],
  );

  const hydrateConversationIdentity = React.useCallback(
    async (cid: string, row?: MessagePayload) => {
      const existing = conversationHydrationInFlightRef.current.get(cid);
      if (existing) return existing;
      const now = Date.now();
      const lastTry = lastConversationHydrationAttemptRef.current.get(cid) ?? 0;
      if (now - lastTry < 3000) return;
      lastConversationHydrationAttemptRef.current.set(cid, now);
      const task = (async () => {
        try {
          const me = meIdRef.current;
          let peerId: string | null =
            conversationPeerRef.current.get(cid) ?? null;
          if (peerId && me && peerId === me) {
            conversationPeerRef.current.delete(cid);
            peerId = null;
          }
          const senderId =
            typeof row?.sender_id === "string" ? row.sender_id.trim() : "";
          if (!peerId && me && senderId && senderId !== me) {
            peerId = senderId;
          }
          if (!peerId) {
            const r = await fetch(
              `/api/chat/history?conversationId=${encodeURIComponent(cid)}&limit=1`,
              { credentials: "include", cache: "no-store" },
            );
            const j = await r.json().catch(() => ({}));
            const parts = j?.participants as
              | { customer_id?: string; pro_id?: string }
              | undefined;
            if (me && parts?.customer_id && parts?.pro_id) {
              peerId = me === parts.pro_id ? parts.customer_id : parts.pro_id;
            }
          }
          if (!peerId && !me) return;
          if (!peerId) return;
          if (me && peerId === me) return;
          conversationPeerRef.current.set(cid, peerId);
          const profile = await fetchProfileIdentity(peerId);
          if (profile) {
            applyIdentityToConversation(cid, profile);
          }
          if (!roomsRevalidatedByConversationRef.current.has(cid)) {
            roomsRevalidatedByConversationRef.current.add(cid);
            void revalidateRoomsBestEffort();
          }
        } finally {
          conversationHydrationInFlightRef.current.delete(cid);
        }
      })();
      conversationHydrationInFlightRef.current.set(cid, task);
      return task;
    },
    [
      applyIdentityToConversation,
      fetchProfileIdentity,
      revalidateRoomsBestEffort,
    ],
  );

  useEffect(() => {
    if (!meId) return;
    const pending = items
      .filter(
        (item) =>
          isPlaceholderChatTitle(item.title) ||
          !hasUsableAvatar(item.avatarUrl),
      )
      .map((item) => item.id);
    for (const cid of pending) {
      void hydrateConversationIdentity(cid);
    }
  }, [items, meId, hydrateConversationIdentity]);

  // Clear unread on navigation into a conversation
  useEffect(() => {
    if (!activeId) return;
    setItems((prev) =>
      prev.map((c) =>
        c.id === activeId ? { ...c, unread: false, unreadCount: 0 } : c,
      ),
    );
  }, [activeId]);

  // Realtime via helper component (minimal wiring inside ChatList)
  const handleGlobalInsert = React.useCallback(
    (cid: string, row: MessagePayload, isActive: boolean) => {
      const rawBody =
        typeof row?.body === "string" && row.body.trim().length
          ? row.body
          : typeof row?.text === "string"
            ? row.text
            : "";
      const body = (() => {
        const s = String(rawBody || "").trim();
        return /el pago está en custodia/i.test(s) ? "" : s;
      })();
      let needsHydration = false;
      let shouldRevalidateRooms = false;
      setItems((prev) => {
        const copy = [...prev];
        const i = copy.findIndex((c) => c.id === cid);
        if (i === -1) {
          // Nuevo chat: usar la mejor identidad cacheada y luego hidratar.
          const createdAt = row?.created_at
            ? String(row.created_at)
            : new Date().toISOString();
          const senderId =
            typeof row?.sender_id === "string" ? row.sender_id.trim() : "";
          const cachedProfile = senderId
            ? (profileCacheRef.current.get(senderId) ?? null)
            : null;
          const initialIdentity = pickBetterChatIdentity(
            {},
            {
              title: cachedProfile?.name,
              avatarUrl: cachedProfile?.avatarUrl,
              otherLastActiveAt: cachedProfile?.lastActiveAt,
            },
          );
          const provisional: ChatSummary = {
            id: cid,
            title: initialIdentity.title || "Contacto",
            preview: body || null,
            lastMessageAt: createdAt,
            unread: isActive ? false : true,
            avatarUrl: initialIdentity.avatarUrl,
            requestTitle: null,
            unreadCount: isActive ? 0 : 1,
            otherLastActiveAt: initialIdentity.otherLastActiveAt,
          };
          copy.unshift(provisional);
          needsHydration =
            isPlaceholderChatTitle(initialIdentity.title) ||
            !hasUsableAvatar(initialIdentity.avatarUrl);
          shouldRevalidateRooms =
            !roomsRevalidatedByConversationRef.current.has(cid);
          return copy;
        }
        const prevItem = copy[i];
        const nextCount =
          (prevItem.unreadCount ?? (prevItem.unread ? 1 : 0)) +
          (isActive ? 0 : 1);
        const updated: ChatSummary = {
          ...prevItem,
          preview:
            body || prevItem.preview || prevItem.requestTitle || prevItem.title,
          lastMessageAt: row?.created_at
            ? String(row.created_at)
            : prevItem.lastMessageAt,
          unread: isActive ? false : true,
          unreadCount: isActive ? 0 : Math.min(nextCount, 99),
        };
        // Reordenar: si no es el chat activo, mover al tope; si es activo, mantener índice
        copy.splice(i, 1);
        if (!isActive) copy.unshift(updated);
        else copy.splice(i, 0, updated);
        if (
          isPlaceholderChatTitle(prevItem.title) ||
          !hasUsableAvatar(prevItem.avatarUrl)
        ) {
          needsHydration = true;
        }
        return copy;
      });
      if (needsHydration) void hydrateConversationIdentity(cid, row);
      if (shouldRevalidateRooms) {
        roomsRevalidatedByConversationRef.current.add(cid);
        void revalidateRoomsBestEffort();
      }
      if (!isActive) {
        const id = cid;
        setFlash((prev) => {
          const s = new Set(prev);
          s.add(id);
          return s;
        });
        const existing = timersRef.current.get(id);
        if (existing) clearTimeout(existing);
        const t = setTimeout(() => {
          setFlash((prev) => {
            if (!prev.has(id)) return prev;
            const s = new Set(prev);
            s.delete(id);
            return s;
          });
          timersRef.current.delete(id);
        }, 1300);
        timersRef.current.set(id, t);
      }
    },
    [hydrateConversationIdentity, revalidateRoomsBestEffort],
  );
  const onDelete = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/chat/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        const msg = data?.error || "No se pudo eliminar el chat";
        throw new Error(msg);
      }
      // activar animación de salida antes de quitar del estado
      setBusyId(null);
      setRemovingId(id);
      setTimeout(() => {
        setItems((prev) => prev.filter((c) => c.id !== id));
        setRemovingId(null);
      }, 300);
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert((e as Error).message || "Error eliminando chat");
    } finally {
      // si hubo error, liberar busy aquí; si no, ya se liberó antes
      setBusyId((curr) => (curr === id ? null : curr));
    }
  };

  if (!items.length) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Sin mensajes todavía.
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-[#fbfbfb]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-blue-100/50 bg-[#fbfbfb] sticky top-0 z-10">
        <div className="font-medium text-sm text-slate-700">Chats</div>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded border border-blue-100/50 hover:bg-blue-100/20"
        >
          {editing ? "Listo" : "Editar"}
        </button>
      </div>
      <ul
        className="divide-y"
        data-testid="chat-thread-list"
        aria-live="polite"
        aria-relevant="additions text"
      >
        <ChatListRealtime
          meId={meId}
          onUnreadIncrement={handleGlobalInsert}
          getChatTitle={(id) =>
            itemsRef.current.find((x) => x.id === id)?.title || ""
          }
          onRecoveryNeeded={() => {
            void revalidateRoomsBestEffort();
          }}
        />
        {items.map((c) => (
          <ChatListItem
            key={c.id}
            chat={c}
            isActive={activeId === c.id}
            isNewArrival={flash.has(c.id)}
            editing={editing}
            deleting={busyId === c.id}
            removing={removingId === c.id}
            typing={!!typingMap[c.id]}
            onDelete={() => onDelete(c.id)}
            DeleteIcon={Trash2}
          />
        ))}
      </ul>
    </div>
  );
}
