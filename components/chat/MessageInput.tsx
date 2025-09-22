"use client";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function MessageInput({
  onSend,
  disabled,
  autoFocus,
  onTyping,
}: {
  onSend: (text: string) => Promise<void> | void;
  disabled?: boolean;
  autoFocus?: boolean;
  onTyping?: () => void;
}) {
  const [text, setText] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const taRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useEffect(() => {
    if (autoFocus && taRef.current) {
      try {
        taRef.current.focus();
      } catch {
        /* ignore */
      }
    }
  }, [autoFocus]);

  async function handleSend() {
    const t = text.trim();
    if (!t || sending || disabled) return;
    setSending(true);
    try {
      await onSend(t);
      setText("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border-t p-2">
      <Textarea
        ref={taRef}
        id="chat-message"
        name="chat-message"
        aria-label="Escribe un mensaje"
        placeholder="Escribe un mensaje…"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (onTyping) onTyping();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void handleSend();
          }
          if (onTyping) onTyping();
        }}
        rows={3}
      />
      <div className="mt-2 flex justify-end">
        <Button
          size="sm"
          onClick={() => void handleSend()}
          disabled={sending || disabled || !text.trim()}
          aria-busy={sending}
        >
          {sending ? "Enviando…" : "Enviar"}
        </Button>
      </div>
    </div>
  );
}
