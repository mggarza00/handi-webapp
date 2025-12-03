/* eslint-disable import/order */
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { normalizeAvatarUrl, parseSupabaseStoragePath } from "@/lib/avatar";
import * as React from "react";
import { Loader2 } from "lucide-react";
import AvatarWithSkeleton from "@/components/ui/AvatarWithSkeleton";
import { cn } from "@/lib/utils";
import type { ChatSummary } from "./types";
import formatPresence from "./presence";

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

function resolveUnreadCount(chat: ChatSummary): number {
  if (typeof chat.unreadCount === "number") return Math.max(0, chat.unreadCount);
  return chat.unread ? 1 : 0;
}

export type Props = {
  chat: ChatSummary;
  isActive?: boolean; // fila seleccionada
  isNewArrival?: boolean; // true al recibir mensaje recientemente
  // Opcionales para modo edición/eliminación
  editing?: boolean;
  removing?: boolean;
  deleting?: boolean;
  typing?: boolean;
  onDelete?: () => void;
  DeleteIcon?: React.ComponentType<{ className?: string }>;
};

function ChatListItem({
  chat,
  isActive,
  isNewArrival,
  editing,
  removing,
  deleting,
  typing,
  onDelete,
  DeleteIcon,
}: Props) {
  const chatId = chat.id;
  const avatarUrl = chat.avatarUrl ?? null;
  const rawTitle = typeof chat.title === "string" ? chat.title : "";
  const trimmedTitle = rawTitle.trim();
  const displayTitle = trimmedTitle.length > 0 ? rawTitle : "Contacto";
  const fallbackPreview =
    typeof chat.requestTitle === "string" && chat.requestTitle.trim().length > 0
      ? chat.requestTitle
      : typeof chat.preview === "string"
        ? chat.preview
        : "";
  const secondaryLine = typing ? "Escribiendo" : fallbackPreview;
  const secondaryText = typeof secondaryLine === "string" ? secondaryLine.trim() : "";
  const showSecondary = secondaryText.length > 0;
  const secondaryClasses = cn(
    "text-xs mt-0.5 line-clamp-1",
    typing ? "text-blue-600 font-medium" : "text-muted-foreground",
  );
  const secondaryTestId = typing ? "chat-thread-typing" : undefined;
  const unreadCount = resolveUnreadCount(chat);
  const isUnread = unreadCount > 0;
  const unreadLabel = `${unreadCount} ${unreadCount === 1 ? "mensaje no leído" : "mensajes no leídos"}`;
  const lastMessageAt = chat.lastMessageAt ?? null;
  const presence = formatPresence(chat.otherLastActiveAt ?? null);
  const presenceClasses = "text-[11px] text-slate-400 mt-0.5";

  // Resolve avatar URL: sign Supabase storage paths; allow external URLs and proxy paths
  const supabase = React.useMemo(() => createSupabaseBrowser(), []);
  const [avatarSrc, setAvatarSrc] = React.useState<string | null>(() => normalizeAvatarUrl(avatarUrl));
  React.useEffect(() => {
    const url = avatarUrl;
    const norm = normalizeAvatarUrl(url);
    if (!url) { setAvatarSrc(null); return; }
    // Pass through external URLs and API proxy
    if (/^https?:\/\//i.test(url) || url.startsWith('/api/avatar/')) { setAvatarSrc(url); return; }
    // If normalize produced a full absolute URL, use it and do not attempt to sign
    if (norm && /^https?:\/\//i.test(norm)) { setAvatarSrc(norm); return; }
    // Try to sign (supports '/storage/v1/object/public/<bucket>/<key>' and '<bucket>/<key>' and 'public/<bucket>/<key>')
    const parsed = parseSupabaseStoragePath(url);
    if (!parsed) { setAvatarSrc(norm); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.storage.from(parsed.bucket).createSignedUrl(parsed.key, 600);
        if (!cancelled) setAvatarSrc(!error && data?.signedUrl ? data.signedUrl : (norm || null));
      } catch {
        if (!cancelled) setAvatarSrc(norm || null);
      }
    })();
    return () => { cancelled = true; };
  }, [avatarUrl, supabase]);

  return (
    <li
      data-chat-id={chatId}
      className={cn(
        "relative flex items-center gap-3 px-3 py-2 rounded-xl transition-colors",
        isActive ? "bg-slate-200" : "hover:bg-slate-50",
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
                src={avatarSrc || "/images/Favicon-v1-jpeg.jpg"}
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
              {showSecondary ? (
                <div className={secondaryClasses} data-testid={secondaryTestId}>
                  {typing ? "Escribiendo" : secondaryText}
                </div>
              ) : null}
              <div className={presenceClasses}>{presence}</div>
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
  const chatA = a.chat;
  const chatB = b.chat;
  return (
    chatA.id === chatB.id &&
    (chatA.avatarUrl ?? null) === (chatB.avatarUrl ?? null) &&
    (chatA.title ?? "") === (chatB.title ?? "") &&
    (chatA.preview ?? null) === (chatB.preview ?? null) &&
    (chatA.requestTitle ?? null) === (chatB.requestTitle ?? null) &&
    (chatA.lastMessageAt ?? null) === (chatB.lastMessageAt ?? null) &&
    (chatA.otherLastActiveAt ?? null) === (chatB.otherLastActiveAt ?? null) &&
    resolveUnreadCount(chatA) === resolveUnreadCount(chatB) &&
    !!chatA.unread === !!chatB.unread &&
    !!a.isActive === !!b.isActive &&
    !!a.isNewArrival === !!b.isNewArrival &&
    !!a.editing === !!b.editing &&
    !!a.removing === !!b.removing &&
    !!a.deleting === !!b.deleting &&
    !!a.typing === !!b.typing &&
    a.DeleteIcon === b.DeleteIcon &&
    a.onDelete === b.onDelete
  );
}

export default React.memo(ChatListItem, areEqual);
