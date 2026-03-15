"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { MessageCircle, Send, Loader2, ArrowLeft } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ASSISTANT_OPEN_EVENT,
  type AssistantOpenPayload,
} from "@/lib/assistant/events";
import { parseAssistantPayload } from "@/lib/assistant/protocol";
import type { AssistantAction } from "@/types/assistant";

type Role = "user" | "assistant";
type Msg = { role: Role; content: string; actions?: AssistantAction[] };

export default function AssistantPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin =
    pathname === "/admin" || (pathname ?? "").startsWith("/admin/");
  const [open, setOpen] = useState(false);
  const [hasBottomBar, setHasBottomBar] = useState(false);
  const onChatDetail = useMemo(
    () => /^\/mensajes\/[\w-]+/i.test(pathname || ""),
    [pathname],
  );

  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: "Hola, soy el asistente de Handi. ¿En qué te ayudo?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const clientBar = document.getElementById("mobile-client-tabbar");
    const proBar = document.getElementById("pro-mobile-tabbar");
    setHasBottomBar(!!clientBar || !!proBar);
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleAssistantOpen = (event: Event) => {
      const detail = (event as CustomEvent<AssistantOpenPayload>).detail || {};
      if (detail.message) {
        setInput(detail.message);
      }
      setOpen(true);
    };
    window.addEventListener(
      ASSISTANT_OPEN_EVENT,
      handleAssistantOpen as EventListener,
    );
    return () => {
      window.removeEventListener(
        ASSISTANT_OPEN_EVENT,
        handleAssistantOpen as EventListener,
      );
    };
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, open]);

  function handleClose() {
    if (abortRef.current) abortRef.current.abort();
    setOpen(false);
  }

  function runAction(action: AssistantAction) {
    const href = String(action?.href || "").trim();
    if (!href) return;
    if (action.type === "app_link") {
      router.push(href);
      return;
    }
    window.open(href, "_blank", "noopener,noreferrer");
  }

  const canSend = Boolean(input.trim()) && !isSending;
  const sseBufferRef = useRef("");

  async function handleSend() {
    if (!canSend) return;
    const userMsg: Msg = { role: "user", content: input.trim() };
    setMessages((prev) => [
      ...prev,
      userMsg,
      { role: "assistant", content: "" },
    ]);
    setInput("");
    setIsSending(true);

    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          page: { pathname },
          user: {},
        }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let finished = false;
      while (!finished) {
        const { done, value } = await reader.read();
        finished = done;
        if (done) break;
        if (!value) continue;
        sseBufferRef.current += decoder.decode(value, { stream: true });
        const frames = sseBufferRef.current.split("\n\n");
        sseBufferRef.current = frames.pop() || "";
        for (const f of frames) {
          if (!f || !f.startsWith("data:")) continue;
          const payload = f.startsWith("data: ") ? f.slice(6) : f.slice(5);
          if (payload === "[DONE]") continue;
          const event = parseAssistantPayload(payload);
          setMessages((prev) => {
            const next = [...prev];
            const lastIdx = next.length - 1;
            if (lastIdx < 0 || next[lastIdx].role !== "assistant") return next;
            if (event.type === "actions") {
              next[lastIdx] = { ...next[lastIdx], actions: event.actions };
              return next;
            }
            if (event.type === "text" || event.type === "legacy_text") {
              next[lastIdx] = {
                ...next[lastIdx],
                content: (next[lastIdx].content || "") + event.delta,
              };
            }
            return next;
          });
        }
      }
    } catch (error) {
      console.error("[AssistantPanel]", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Lo siento, ocurrió un error al responder. Intenta de nuevo.",
          actions: [
            {
              type: "whatsapp",
              label: "Abrir WhatsApp",
              href: "https://wa.me/528130878691",
            },
          ],
        },
      ]);
    } finally {
      setIsSending(false);
      abortRef.current = null;
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  if (isAdmin) return null;

  return (
    <div
      className={`fixed right-4 z-50 ${onChatDetail ? "hidden md:block" : ""} ${
        onChatDetail
          ? "top-20 bottom-auto md:top-auto md:bottom-4"
          : (hasBottomBar ? "bottom-[92px]" : "bottom-4") + " md:bottom-4"
      }`}
    >
      <Sheet
        open={open}
        onOpenChange={(v) => {
          if (!v) {
            handleClose();
            return;
          }
          setOpen(true);
        }}
      >
        <SheetTrigger asChild>
          <Button
            size="lg"
            variant="outline"
            className="rounded-full gap-2 border border-border bg-neutral-50/80 dark:bg-neutral-900/40 backdrop-blur-md text-black shadow-sm hover:bg-neutral-200 dark:hover:bg-neutral-800"
          >
            <MessageCircle className="h-5 w-5" />
            Asistente
          </Button>
        </SheetTrigger>
        <SheetContent
          side="right"
          className="w-full max-w-md h-[100dvh] flex flex-col"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
          }}
        >
          <SheetHeader className="sticky top-0 z-10 h-24 flex items-center px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
            <SheetTitle className="w-full flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="md:hidden"
                aria-label="Cerrar asistente"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <span className="flex-1 text-center md:text-left md:ml-10 text-[22px]">
                Asistente Handi
              </span>
              <Image
                src="/images/handee_mascota.gif"
                alt="Handee mascota"
                width={96}
                height={96}
                className="h-24 w-auto object-contain"
                unoptimized
              />
            </SheetTitle>
          </SheetHeader>

          <div className="mt-2 flex-1 rounded-2xl border overflow-hidden">
            <div
              ref={listRef}
              className="h-full overflow-auto overscroll-contain p-3 bg-background/50 space-y-3"
            >
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className="max-w-[80%]">
                    <div
                      className={`${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"} rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words`}
                    >
                      {m.content}
                    </div>
                    {m.role === "assistant" &&
                    Array.isArray(m.actions) &&
                    m.actions.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {m.actions.map((action, idx) => (
                          <Button
                            key={`${i}-${idx}-${action.label}`}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 text-xs"
                            onClick={() => runAction(action)}
                          >
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t p-3 pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-start gap-2">
              <Textarea
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  const el = listRef.current;
                  if (!el) return;
                  setTimeout(() => {
                    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
                  }, 50);
                }}
                placeholder="Escribe tu mensaje..."
              />
              <Button
                onClick={() => void handleSend()}
                disabled={!canSend}
                className="gap-2 h-10 self-start"
              >
                {isSending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enviando
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Enviar
                  </>
                )}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
