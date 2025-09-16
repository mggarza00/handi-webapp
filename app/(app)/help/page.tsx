"use client";

import * as React from "react";
import Link from "next/link";

import PageContainer from "@/components/page-container";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type FAQ = {
  id: string;
  category: "General" | "Clientes" | "Profesionales" | "Pagos" | "Cuenta";
  q: string;
  a: React.ReactNode;
};

export default function Help() {
  const faqs: FAQ[] = [
    {
      id: "crear-solicitud",
      category: "Clientes",
      q: "¿Cómo creo una solicitud?",
      a: (
        <>
          <p>
            Ve a{" "}
            <Link className="underline" href="/requests/new">
              /requests/new
            </Link>
            , llena el formulario con el título, descripción, ciudad y, si lo
            deseas, adjunta imágenes (máx. 5MB c/u). Al enviar, tu solicitud
            quedará visible para profesionales (según RLS del sistema).
          </p>
        </>
      ),
    },
    {
      id: "postularse",
      category: "Profesionales",
      q: "¿Cómo me postulo a un trabajo?",
      a: (
        <>
          <p>
            Abre la solicitud (por ejemplo, desde{" "}
            <span className="font-mono">/requests/:id</span>) y usa el botón
            &quot;Postularse&quot;. Luego podrás dar seguimiento en{" "}
            <Link className="underline" href="/applied">
              /applied
            </Link>
            .
          </p>
        </>
      ),
    },
    {
      id: "chat-candado",
      category: "General",
      q: "¿Cómo funciona el chat con candado?",
      a: (
        <>
          <p>
            Por seguridad, el chat bloquea compartir datos personales (emails,
            teléfonos, URLs o direcciones). Si detectamos estos patrones, el
            mensaje no se envía. Esto protege a ambas partes según el Documento
            Maestro.
          </p>
        </>
      ),
    },
    {
      id: "pagos-fee",
      category: "Pagos",
      q: "Pagos y fee de $50 MXN",
      a: (
        <>
          <p>
            Cuando un acuerdo es aceptado, el cliente puede pagar el fee de $50
            MXN desde la sección de Acuerdos. Esto desbloquea los datos de
            contacto del profesional. Los pagos se procesan vía Stripe Checkout.
          </p>
        </>
      ),
    },
    {
      id: "cerrar-acuerdo",
      category: "General",
      q: "¿Cómo completo un acuerdo y cierro mi solicitud?",
      a: (
        <>
          <p>
            Tras pagar el fee y avanzar el trabajo, se puede marcar el acuerdo
            como &quot;En progreso&quot; y posteriormente
            &quot;Completado&quot;. La solicitud cambia de estado acorde al
            flujo definido (active → in_process → completed).
          </p>
        </>
      ),
    },
    {
      id: "perfiles-galeria",
      category: "Cuenta",
      q: "Perfiles y galería",
      a: (
        <>
          <p>
            Configura tu perfil en{" "}
            <Link className="underline" href="/profile/setup">
              /profile/setup
            </Link>{" "}
            (nombre, titular, ciudad, bio, avatar) y sube tu galería de trabajos
            (imágenes). Tu perfil público está en{" "}
            <span className="font-mono">/profiles/:id</span>.
          </p>
        </>
      ),
    },
    {
      id: "seguridad-privacidad",
      category: "General",
      q: "Seguridad y privacidad",
      a: (
        <>
          <p>
            No compartas datos sensibles por el chat. Revisa nuestro aviso de
            privacidad en{" "}
            <Link className="underline" href="/privacy">
              /privacy
            </Link>
            .
          </p>
        </>
      ),
    },
  ];

  const categories = [
    "Todos",
    "General",
    "Clientes",
    "Profesionales",
    "Pagos",
    "Cuenta",
  ] as const;
  const [query, setQuery] = React.useState("");
  const [cat, setCat] = React.useState<(typeof categories)[number]>("Todos");
  const [expandedAll, setExpandedAll] = React.useState(false);

  // Abrir por hash (#id)
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const id = decodeURIComponent(
      (window.location.hash || "").replace(/^#/, ""),
    );
    if (!id) return;
    const el = document.getElementById(id) as HTMLDetailsElement | null;
    if (el) {
      el.open = true;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const filtered = faqs.filter((f) => {
    const byCat = cat === "Todos" || f.category === cat;
    if (!byCat) return false;
    if (!query.trim()) return true;
    const qlc = query.toLowerCase();
    const text = (
      f.q +
      " " +
      (typeof f.a === "string" ? f.a : "")
    ).toLowerCase();
    return text.includes(qlc);
  });

  return (
    <PageContainer>
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Centro de ayuda</h2>
        <p className="text-neutral-600 dark:text-neutral-300">
          ¿Tienes dudas? Escríbenos o revisa nuestras preguntas frecuentes.
        </p>

        {/* Controles */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar (palabras clave)"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`rounded-full border px-3 py-1.5 text-sm ${cat === c ? "bg-black text-white border-black" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"}`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setExpandedAll(true)}>
              Expandir todo
            </Button>
            <Button variant="outline" onClick={() => setExpandedAll(false)}>
              Colapsar todo
            </Button>
          </div>
        </div>

        {/* Listado */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-neutral-600">
              No encontramos resultados. Intenta con otras palabras.
            </p>
          ) : null}
          {filtered.map((item) => (
            <details
              id={item.id}
              key={item.id}
              className="rounded-xl border p-3"
              open={expandedAll}
            >
              <summary className="cursor-pointer text-sm font-medium flex items-center justify-between gap-2">
                <span>{item.q}</span>
                <span className="text-xs rounded-full border px-2 py-0.5 text-neutral-600">
                  {item.category}
                </span>
              </summary>
              <div className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
                {item.a}
              </div>
              <div className="mt-3 text-xs text-neutral-500">
                <Link className="underline" href={`/help#${item.id}`}>
                  Copiar enlace
                </Link>
              </div>
            </details>
          ))}
        </div>

        {/* Recursos rápidos */}
        <div className="rounded-xl border p-4 space-y-2">
          <h3 className="text-lg font-medium">Recursos</h3>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link className="underline" href="/requests/new">
              /requests/new
            </Link>
            <Link className="underline" href="/applied">
              /applied
            </Link>
            <Link className="underline" href="/profile/setup">
              /profile/setup
            </Link>
          </div>
        </div>

        {/* Contacto */}
        <div className="rounded-xl border p-4">
          <h3 className="text-lg font-medium">Contacto</h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            WhatsApp:{" "}
            <a className="underline" href="https://wa.me/5218181611335">
              +52 1 81 8161 1335
            </a>{" "}
            · Email:{" "}
            <a
              className="underline"
              href="mailto:hola@handi.mx?subject=Soporte%20Handi"
            >
              hola@handi.mx
            </a>
          </p>
        </div>
      </div>
    </PageContainer>
  );
}
