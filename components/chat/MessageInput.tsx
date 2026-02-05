"use client";
import * as React from "react";
import { Paperclip, Camera } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { scanMessage } from "@/lib/safety/contact-guard";
import { getContactPolicyMessage } from "@/lib/safety/policy";

type MessageInputProps = {
  onSend: (text: string) => Promise<boolean | void> | boolean | void;
  disabled?: boolean;
  autoFocus?: boolean;
  onTyping?: () => void;
  onFocus?: () => void;
  dataPrefix?: string; // e2e: chat | request-chat
  onPickFiles?: () => void;
  onPickCamera?: () => void;
  allowContact?: boolean;
};

export default function MessageInput({
  onSend,
  disabled,
  autoFocus,
  onTyping,
  onFocus,
  dataPrefix = "chat",
  onPickFiles,
  onPickCamera,
  allowContact,
}: MessageInputProps) {
  const [text, setText] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const scan = React.useMemo(
    () => (allowContact ? { hasContact: false } : scanMessage(text)),
    [text, allowContact],
  );
  const hasContact = allowContact ? false : scan.hasContact;

  React.useEffect(() => {
    if (!autoFocus || !textareaRef.current) return;
    try {
      textareaRef.current.focus();
    } catch {
      // ignore
    }
  }, [autoFocus]);

  const handleSend = React.useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || disabled) return;
    setSending(true);
    try {
      const result = await onSend(trimmed);
      if (result !== false) {
        setText("");
      }
    } finally {
      setSending(false);
    }
  }, [text, sending, disabled, onSend]);

  return (
    <div className="border-t p-2 space-y-2">
      <div className="relative">
        <Textarea
          ref={textareaRef}
          id="chat-message"
          name="chat-message"
          data-testid={`${dataPrefix}-input`}
          aria-label="Escribe un mensaje"
          placeholder="Escribe un mensaje..."
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            onTyping?.();
          }}
          onFocus={() => onFocus?.()}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void handleSend();
            }
            onTyping?.();
          }}
          rows={3}
          className={`whitespace-pre-wrap pr-16 ${hasContact ? "border border-destructive focus-visible:ring-destructive" : ""}`}
          aria-invalid={hasContact}
        />
        <div className="pointer-events-none absolute right-2 top-2 flex items-center gap-2">
          <button
            type="button"
            className="pointer-events-auto inline-flex items-center justify-center h-7 w-7 rounded-full hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
            title="Adjuntar archivos"
            aria-label="Adjuntar archivos"
            onClick={() => onPickFiles?.()}
            disabled={sending || disabled}
          >
            <Paperclip className="h-4 w-4 text-slate-600" />
          </button>
          <button
            type="button"
            className="pointer-events-auto inline-flex items-center justify-center h-7 w-7 rounded-full hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
            title="Abrir cámara"
            aria-label="Abrir cámara"
            onClick={() => onPickCamera?.()}
            disabled={sending || disabled}
          >
            <Camera className="h-4 w-4 text-slate-600" />
          </button>
        </div>
      </div>
      {hasContact ? (
        <div className="text-xs text-destructive">
          {getContactPolicyMessage()}
        </div>
      ) : null}
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => void handleSend()}
          disabled={sending || disabled || !text.trim()}
          aria-busy={sending}
          data-testid={`${dataPrefix}-send`}
        >
          {sending ? "Enviando..." : "Enviar"}
        </Button>
      </div>
    </div>
  );
}
