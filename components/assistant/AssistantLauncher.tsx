"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, Send, Phone, ExternalLink, Loader2 } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

export default function AssistantLauncher() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [hasBottomBar, setHasBottomBar] = useState(false);
  const onChatDetail = useMemo(() => /^\/mensajes\/[\w-]+/i.test(pathname || ''), [pathname]);
  const [chatInput, setChatInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([
    { role: "assistant", content: "Hola, soy el asistente de Handi. Â¿En quÃ© te ayudo?" },
  ]);
  const [controller, setController] = useState<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Detectar si hay una barra inferior mÃ³vil (cliente o profesional)
    const clientBar = document.getElementById("mobile-client-tabbar");
    const proBar = document.getElementById("pro-mobile-tabbar");
    setHasBottomBar(!!clientBar || !!proBar);
    // Re-evaluar al cambiar de ruta (por si cambia el rol/vista)
  }, [pathname]);

  const waNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "";
  const waLink = useMemo(() => {
    const base = `https://wa.me/${waNumber}`;
    const text = `Hola, necesito ayuda con esta pÃ¡gina: ${pathname}\n\n${message ? `Mensaje: ${message}` : ""}\n${name ? `Nombre: ${name}` : ""}`;
    const params = new URLSearchParams({ text });
    return `${base}?${params.toString()}`;
  }, [waNumber, pathname, message, name]);

  const canSend = Boolean(message.trim());
  const canChatSend = Boolean(chatInput.trim()) && !isSending;

  async function handleChatSend() {
    if (!chatInput.trim() || isSending) return;
    const userMsg = { role: "user" as const, content: chatInput.trim() };
    setMessages((prev) => [...prev, userMsg, { role: "assistant", content: "" }]);
    setChatInput("");
    setIsSending(true);
    const ac = new AbortController();
    setController(ac);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMsg] }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          setMessages((prev) => {
            const next = [...prev];
            const lastIdx = next.length - 1;
            if (lastIdx >= 0 && next[lastIdx]?.role === "assistant") {
              next[lastIdx] = { role: "assistant", content: (next[lastIdx].content || "") + chunk };
            }
            return next;
          });
        }
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Lo siento, hubo un problema al responder. Intenta de nuevo." },
      ]);
    } finally {
      setIsSending(false);
      setController(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleChatSend();
    }
  }

  return (
    <>
      {/* BotÃ³n flotante fijo en toda la app */}
      <div
        className={`fixed right-4 z-50 ${onChatDetail ? 'hidden md:block' : ''} ${
          // En mÃ³vil dentro de /mensajes/:id, colÃ³calo a la altura del botÃ³n "â† Mensajes"
          onChatDetail
            ? 'top-20 bottom-auto md:top-auto md:bottom-4'
            : (hasBottomBar ? 'bottom-[92px]' : 'bottom-4') + ' md:bottom-4'
        }`}
      >
        <Sheet open={open} onOpenChange={setOpen}>
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
            className="w-full max-w-md h-[100dvh]"
            onOpenAutoFocus={(e) => {
              // Evita que el panel enfoque automáticamente el textarea en móvil
              e.preventDefault();
            }}
          >
            <SheetHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
              <SheetTitle>Asistente Handi</SheetTitle>
            </SheetHeader>

            <div className="mt-4 space-y-4">
              {/* Chat asistente (RAG local) */}
              <div className="rounded-2xl border p-0 overflow-hidden">
                <div className="h-[380px] flex flex-col">
                  <div ref={listRef} className="flex-1 overflow-auto overscroll-contain p-3 space-y-3 bg-background/50">
                    {messages.map((m, i) => (
                      <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"} max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words`}
                        >
                          {m.content}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t p-3 pb-[env(safe-area-inset-bottom)]">
                    <div className="flex items-end gap-2">
                      <Textarea
                        rows={2}
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onFocus={() => {
                          const el = listRef.current;
                          if (!el) return;
                          setTimeout(() => {
                            el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
                          }, 50);
                        }}
                        placeholder="Escribe tu mensajeâ€¦"
                      />
                      <Button onClick={handleChatSend} disabled={!canChatSend} className="gap-2 h-10">
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
                    {controller ? (
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        Respondiendoâ€¦
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* OpciÃ³n adicional: WhatsApp */}
              <div className="rounded-2xl border p-4">
                <h3 className="mb-2 font-semibold">WhatsApp</h3>
                <p className="mb-3 text-sm text-slate-600">
                  Chatea por WhatsApp. Incluimos la URL de la pÃ¡gina actual para
                  contexto.
                </p>

                <div className="grid gap-2">
                  <label className="text-sm font-medium">
                    Tu nombre (opcional)
                  </label>
                  <Input
                    placeholder="Ej. Mauricio"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="mt-3 grid gap-2">
                  <label className="text-sm font-medium">Mensaje</label>
                  <Textarea
                    rows={4}
                    placeholder="Describe brevemente tu duda o lo que necesitasâ€¦"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    asChild
                    disabled={!waNumber || !canSend}
                    className="gap-2"
                  >
                    <a href={waLink} target="_blank" rel="noopener noreferrer">
                      <Phone className="h-4 w-4" />
                      Abrir WhatsApp
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                  {!waNumber ? (
                    <span className="text-xs text-red-600">
                      Falta configurar NEXT_PUBLIC_WHATSAPP_NUMBER en .env.local
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Fin secciones */}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
