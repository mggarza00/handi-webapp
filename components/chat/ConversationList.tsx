/* eslint-disable import/order */
"use client";
import * as React from "react";
import Link from "next/link";
import { normalizeAvatarUrl } from "@/lib/avatar";
import { Button } from "@/components/ui/button";

type Item = {
  id: string;
  title: string; // nombre del profesional
  preview?: string | null; // título de la solicitud
  lastMessageAt?: string | null;
  unread?: boolean;
  avatarUrl?: string | null;
};

export default function ConversationList({ items }: { items: Item[] }) {
  if (!items.length)
    return (
      <div className="rounded border bg-white p-8 text-center">
        <div className="mx-auto mb-3 size-12 rounded-full bg-slate-100" aria-hidden />
        <div className="text-sm text-muted-foreground mb-4">Aún no hay conversaciones.</div>
        <div className="flex items-center justify-center gap-2">
          <Link href="/search">
            <Button size="sm" variant="default">Explorar profesionales</Button>
          </Link>
          <Link href="/requests">
            <Button size="sm" variant="outline">Ver mis solicitudes</Button>
          </Link>
        </div>
      </div>
    );
  function formatRel(ts?: string | null) {
    if (!ts) return "";
    const d = new Date(ts);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    const hm = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (sameDay) return hm;
    if (isYesterday) return `ayer ${hm}`;
    return d.toLocaleDateString() + ' ' + hm;
  }
  return (
    <ul className="divide-y rounded border bg-white">
      {items.map((c) => (
        <li key={c.id} className="p-3 hover:bg-neutral-50">
          <Link href={`/messages/${c.id}`} className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={normalizeAvatarUrl(c.avatarUrl) || "/avatar.png"}
                alt={(c.title || "").trim() || "El nombre del profesional"}
                className="size-9 rounded-full object-cover border shrink-0"
              />
              <div className="min-w-0">
                <div className="font-medium text-sm truncate flex items-center gap-2">
                  {c.unread ? (
                    <span className="inline-block size-2 rounded-full bg-blue-500" aria-label="No leído"></span>
                  ) : null}
                  <span className="truncate">{(c.title || "").trim() || "El nombre del profesional"}</span>
                </div>
                {c.preview ? (
                  <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{c.preview}</div>
                ) : null}
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground shrink-0">
              {formatRel(c.lastMessageAt)}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
/* eslint-disable import/order */
