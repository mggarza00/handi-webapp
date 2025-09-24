/* eslint-disable import/order */
import Link from "next/link";
import type { ChatSummary } from "./types";
import { normalizeAvatarUrl } from "@/lib/avatar";
import * as React from "react";
import { Loader2 } from "lucide-react";

function formatRel(ts?: string | null) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const hm = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return hm;
  if (isYesterday) return `ayer ${hm}`;
  return d.toLocaleDateString() + " " + hm;
}

export default function ChatListItem({
  chat,
  active,
  editing,
  removing,
  deleting,
  onDelete,
  DeleteIcon,
}: {
  chat: ChatSummary;
  active?: boolean;
  editing?: boolean;
  removing?: boolean;
  deleting?: boolean;
  onDelete?: () => void;
  DeleteIcon?: React.ComponentType<{ className?: string }>;
}) {
  const rawTitle = typeof chat.title === "string" ? chat.title : "";
  const trimmedTitle = rawTitle.trim();
  const displayTitle = trimmedTitle.length > 0 ? rawTitle : "Contacto";
  const rawRequestTitle = typeof chat.requestTitle === "string" ? chat.requestTitle : "";
  const trimmedRequest = rawRequestTitle.trim();
  const subtitle =
    trimmedRequest.length > 0 ? rawRequestTitle : "la solicitud de servicio";

  return (
    <li
      className={`p-3 hover:bg-neutral-50 transition-all duration-300 ease-in-out ${
        active ? "bg-neutral-50" : ""
      } ${
        removing
          ? "-translate-x-full opacity-0 pointer-events-none"
          : deleting
            ? "opacity-60 animate-pulse pointer-events-none"
            : ""
      }`}
      aria-busy={deleting ? true : undefined}
      data-testid="chat-thread-item"
    >
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/mensajes/${chat.id}`}
          onClick={deleting || removing ? (e) => e.preventDefault() : undefined}
          aria-disabled={deleting || removing ? true : undefined}
          className="flex items-center justify-between gap-3 flex-1 min-w-0"
        >
          <div className="min-w-0 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={normalizeAvatarUrl(chat.avatarUrl) || "/avatar.png"}
              alt={displayTitle}
              className="size-9 rounded-full object-cover border shrink-0"
            />
            <div className="min-w-0">
              <div className="font-medium text-sm truncate flex items-center gap-2">
                {chat.unread ? (
                  <span className="inline-block size-2 rounded-full bg-blue-500" aria-label="No leído" data-testid="chat-unread-badge"></span>
                ) : null}
                <span className="truncate" data-testid="chat-thread-title">{displayTitle}</span>
              </div>
              <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{subtitle}</div>
            </div>
          </div>
        </Link>
        {editing ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete?.();
            }}
            className={`inline-flex items-center justify-center size-7 rounded border text-red-600 hover:bg-red-50 ${
              deleting || removing ? "opacity-50 cursor-not-allowed" : ""
            }`}
            disabled={!!(deleting || removing)}
            aria-label="Eliminar chat"
            title="Eliminar"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : DeleteIcon ? (
              <DeleteIcon className="h-4 w-4" />
            ) : (
              <span>×</span>
            )}
          </button>
        ) : (
          <div className="text-[11px] text-muted-foreground shrink-0">{formatRel(chat.lastMessageAt)}</div>
        )}
      </div>
    </li>
  );
}
