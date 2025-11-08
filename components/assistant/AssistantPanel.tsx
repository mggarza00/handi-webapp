"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, Send, Loader2 } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Role = "user" | "assistant";
type Msg = { role: Role; content: string };

export default function AssistantPanel() {
  const pathname = usePathname();
  const isAdmin = pathname === "/admin" || (pathname ?? "").startsWith("/admin/");
  if (isAdmin) return null;
  const [open, setOpen] = useState(false);
  const [hasBottomBar, setHasBottomBar] = useState(false);
  const onChatDetail = useMemo(() => /^\/mensajes\/[\w-]+/i.test(pathname || ""), [pathname]);

  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hola, soy el asistente de Handi. ¿En qué te ayudo?" },
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
    // autoscroll on new message
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const canSend = Boolean(input.trim()) && !isSending;

  const sseBufferRef = useRef("");

  async function handleSend() {
    if (!canSend) return;
    const userMsg: Msg = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg, { role: "assistant", content: "" }]);
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
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        sseBufferRef.current += decoder.decode(value, { stream: true });
        const frames = sseBufferRef.current.split("\n\n");
        sseBufferRef.current = frames.pop() || "";
        for (const f of frames) {
          if (!f) continue;
          // Do not trim to preserve leading spaces
          if (!f.startsWith("data:")) continue;
          let payload = f.startsWith("data: ") ? f.slice(6) : f.slice(5);
          if (payload === "[DONE]") continue;
          setMessages((prev) => {
            const next = [...prev];
            const lastIdx = next.length - 1;
            if (lastIdx >= 0 && next[lastIdx].role === "assistant") {
              next[lastIdx] = { role: "assistant", content: (next[lastIdx].content || "") + payload };
            }
            return next;
          });
        }
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Lo siento, ocurrió un error al responder. Intenta de nuevo." },
      ]);
    } finally {
      setIsSending(false);
      abortRef.current = null;
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div
      className={`fixed right-4 z-50 ${onChatDetail ? "hidden md:block" : ""} ${
        onChatDetail
          ? "top-20 bottom-auto md:top-auto md:bottom-4"
          : (hasBottomBar ? "bottom-[92px]" : "bottom-4") + " md:bottom-4"
      }`}
    >
      <Sheet open={open} onOpenChange={(v) => {
        if (!v && abortRef.current) abortRef.current.abort();
        setOpen(v);
      }}>
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
            // Evita que Radix enfoque automáticamente el primer elemento (textarea)
            // en móviles/PWA, lo que dispararía el teclado virtual.
            e.preventDefault();
          }}
        >
          <SheetHeader className="sticky top-0 z-10 h-24 flex items-center px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
            <SheetTitle className="w-full flex items-center justify-between">
              <span className="text-left ml-10 text-[22px]">Asistente Handi</span>
              <img src="/images/handee_mascota.gif" alt="Handee mascota" className="h-24 w-auto object-contain" />
            </SheetTitle>
          </SheetHeader>

          {/* Mensajes */}
          <div className="mt-2 flex-1 rounded-2xl border overflow-hidden">
            <div
              ref={listRef}
              className="h-full overflow-auto overscroll-contain p-3 bg-background/50 space-y-3"
            >
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"} max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words`}>{m.content}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Input anclado al fondo del panel */}
          <div className="border-t p-3 pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-start gap-2">
              <Textarea
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  // Asegura que el final del chat quede visible al abrirse el teclado
                  // (especialmente en iOS Safari/PWA).
                  const el = listRef.current;
                  if (!el) return;
                  // Espera un frame para que el viewport se ajuste al teclado.
                  setTimeout(() => {
                    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
                  }, 50);
                }}
                placeholder="Escribe tu mensaje…"
              />
              <Button onClick={handleSend} disabled={!canSend} className="gap-2 h-10 self-start">
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
