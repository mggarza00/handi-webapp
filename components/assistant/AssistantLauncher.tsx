"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, Send, Phone, ExternalLink } from "lucide-react";

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

  useEffect(() => {
    // Detectar si hay una barra inferior móvil (cliente o profesional)
    const clientBar = document.getElementById("mobile-client-tabbar");
    const proBar = document.getElementById("pro-mobile-tabbar");
    setHasBottomBar(!!clientBar || !!proBar);
    // Re-evaluar al cambiar de ruta (por si cambia el rol/vista)
  }, [pathname]);

  const waNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "";
  const waLink = useMemo(() => {
    const base = `https://wa.me/${waNumber}`;
    const text = `Hola, necesito ayuda con esta página: ${pathname}\n\n${message ? `Mensaje: ${message}` : ""}\n${name ? `Nombre: ${name}` : ""}`;
    const params = new URLSearchParams({ text });
    return `${base}?${params.toString()}`;
  }, [waNumber, pathname, message, name]);

  const canSend = Boolean(message.trim());

  return (
    <>
      {/* Botón flotante fijo en toda la app */}
      <div
        className={`fixed right-4 z-50 ${onChatDetail ? 'hidden md:block' : ''} ${
          // En móvil dentro de /mensajes/:id, colócalo a la altura del botón "← Mensajes"
          onChatDetail
            ? 'top-20 bottom-auto md:top-auto md:bottom-4'
            : (hasBottomBar ? 'bottom-[76px]' : 'bottom-4') + ' md:bottom-4'
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
          <SheetContent side="right" className="w-full max-w-md">
            <SheetHeader>
              <SheetTitle>Asistente Handi</SheetTitle>
            </SheetHeader>

            <div className="mt-4 space-y-4">
              {/* Opción 1: WhatsApp */}
              <div className="rounded-2xl border p-4">
                <h3 className="mb-2 font-semibold">WhatsApp</h3>
                <p className="mb-3 text-sm text-slate-600">
                  Chatea por WhatsApp. Incluimos la URL de la página actual para
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
                    placeholder="Describe brevemente tu duda o lo que necesitas…"
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

              {/* Opción 2: Chat integrado (stub) */}
              <div className="rounded-2xl border p-4">
                <h3 className="mb-2 font-semibold">Chat integrado</h3>
                <p className="mb-3 text-sm text-slate-600">
                  Prototipo local (sin backend). En el siguiente paso lo
                  conectamos a /api/assistant.
                </p>
                <div className="grid gap-2">
                  <Textarea rows={3} placeholder="Escribe tu mensaje…" />
                  <Button disabled className="gap-2">
                    <Send className="h-4 w-4" />
                    Enviar (pendiente de backend)
                  </Button>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
