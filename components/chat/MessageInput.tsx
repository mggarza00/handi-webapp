"use client";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { scanMessage } from "@/lib/safety/contact-guard";
import { getContactPolicyMessage } from "@/lib/safety/policy";

type MessageInputProps = {
  onSend: (text: string) => Promise<boolean | void> | boolean | void;
  disabled?: boolean;
  autoFocus?: boolean;
  onTyping?: () => void;
};

export default function MessageInput({ onSend, disabled, autoFocus, onTyping }: MessageInputProps) {
  const [text, setText] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const scan = React.useMemo(() => scanMessage(text), [text]);
  const hasContact = scan.hasContact;

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
      <Textarea
        ref={textareaRef}
        id="chat-message"
        name="chat-message"
        aria-label="Escribe un mensaje"
        placeholder="Escribe un mensaje..."
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          onTyping?.();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void handleSend();
          }
          onTyping?.();
        }}
        rows={3}
        className={`whitespace-pre-wrap ${hasContact ? "border border-destructive focus-visible:ring-destructive" : ""}`}
        aria-invalid={hasContact}
      />
      {hasContact ? <div className="text-xs text-destructive">{getContactPolicyMessage()}</div> : null}
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => void handleSend()}
          disabled={sending || disabled || !text.trim()}
          aria-busy={sending}
        >
          {sending ? "Enviando..." : "Enviar"}
        </Button>
      </div>
    </div>
  );
}
