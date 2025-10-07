/* eslint-disable import/order */
import Link from "next/link";
import { normalizeAvatarUrl } from "@/lib/avatar";
import * as React from "react";
import { Loader2, Mail } from "lucide-react";
import AvatarWithSkeleton from "@/components/ui/AvatarWithSkeleton";
import { cn } from "@/lib/utils";

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

export type Props = {
  chatId: string;
  avatarUrl?: string | null;
  displayName: string;
  lastMessageSnippet?: string | null;
  lastMessageAt?: string | null;
  unreadCount?: number; // 0..n
  isActive?: boolean; // fila seleccionada
  isNewArrival?: boolean; // true al recibir mensaje recientemente
  // Opcionales para modo edición/eliminación
  editing?: boolean;
  removing?: boolean;
  deleting?: boolean;
  onDelete?: () => void;
  DeleteIcon?: React.ComponentType<{ className?: string }>;
};

function ChatListItem({
  chatId,
  avatarUrl,
  displayName,
  lastMessageSnippet,
  lastMessageAt,
  unreadCount: unreadCountProp,
  isActive,
  isNewArrival,
  editing,
  removing,
  deleting,
  onDelete,
  DeleteIcon,
}: Props) {
  const rawTitle = typeof displayName === "string" ? displayName : "";
  const trimmedTitle = rawTitle.trim();
  const displayTitle = trimmedTitle.length > 0 ? rawTitle : "Contacto";
  const rawSnippet = typeof lastMessageSnippet === "string" ? lastMessageSnippet : "";
  const subtitle = rawSnippet.trim().length > 0 ? rawSnippet : "la solicitud de servicio";

  const unreadCount = typeof unreadCountProp === "number" ? Math.max(0, unreadCountProp) : 0;
  const isUnread = unreadCount > 0;
  const unreadLabel = `${unreadCount} ${unreadCount === 1 ? "mensaje no leído" : "mensajes no leídos"}`;

  return (
    <li
      data-chat-id={chatId}
      className={cn(
        "relative flex items-center gap-3 px-3 py-2 rounded-xl transition-colors",
        isActive ? "bg-neutral-50" : (isUnread ? "bg-slate-100/70" : "hover:bg-slate-50"),
        isNewArrival ? "animate-popIn_1.2s_ease_1" : "",
        removing ? "-translate-x-full opacity-0 pointer-events-none" : "",
        deleting ? "opacity-60 animate-pulse pointer-events-none" : "",
      )}
      aria-busy={deleting ? true : undefined}
      data-testid="chat-thread-item"
    >
      <div className="flex items-center justify-between gap-2 w-full">
        <Link
          href={`/mensajes/${chatId}`}
          onClick={deleting || removing ? (e) => e.preventDefault() : undefined}
          aria-disabled={deleting || removing ? true : undefined}
          className="flex items-center justify-between gap-3 w-full"
        >
          <div className="min-w-0 flex items-center gap-3">
            <div className={`relative shrink-0 ${isUnread ? "ring-2 ring-blue-500 rounded-full shadow-[0_0_0_3px_rgba(59,130,246,0.15)]" : ""}`}>
              <AvatarWithSkeleton
                src={normalizeAvatarUrl(avatarUrl) || "/avatar.png"}
                alt={displayTitle}
                sizeClass="size-9"
                className="shrink-0"
              />
              {isUnread ? (
                <span
                  className="absolute -bottom-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] leading-[18px] text-center shadow"
                  aria-label={unreadLabel}
                  title={unreadLabel}
                  data-testid="chat-unread-badge"
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </div>
            <div className="min-w-0">
              <div className="text-sm truncate flex items-center gap-2">
                <span className={`truncate ${isUnread ? "font-semibold text-slate-900" : "font-medium"}`} data-testid="chat-thread-title">{displayTitle}</span>
              </div>
              <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5 flex items-center gap-1">
                {isUnread ? <Mail className="w-3.5 h-3.5 text-blue-600" aria-hidden /> : null}
                <span>{subtitle}</span>
              </div>
            </div>
          </div>
          <div className="text-[11px] text-muted-foreground shrink-0 ml-2">{formatRel(lastMessageAt)}</div>
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
        ) : null}
      </div>
    </li>
  );
}

function areEqual(a: Props, b: Props): boolean {
  return (
    a.chatId === b.chatId &&
    a.avatarUrl === b.avatarUrl &&
    a.displayName === b.displayName &&
    a.lastMessageSnippet === b.lastMessageSnippet &&
    a.lastMessageAt === b.lastMessageAt &&
    (a.unreadCount ?? 0) === (b.unreadCount ?? 0) &&
    !!a.isActive === !!b.isActive &&
    !!a.isNewArrival === !!b.isNewArrival &&
    !!a.editing === !!b.editing &&
    !!a.removing === !!b.removing &&
    !!a.deleting === !!b.deleting &&
    a.DeleteIcon === b.DeleteIcon &&
    a.onDelete === b.onDelete
  );
}

export default React.memo(ChatListItem, areEqual);
