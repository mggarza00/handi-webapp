"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeHelp,
  BookOpen,
  Briefcase,
  CheckCircle2,
  Clipboard,
  ClipboardCheck,
  Filter,
  HandHeart,
  Lock,
  Mail,
  MessageCircle,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  User,
  Wallet,
  Workflow,
} from "lucide-react";

import PageContainer from "@/components/page-container";
import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  getContactPolicyMessage,
  getContactPolicyMode,
} from "@/lib/safety/policy";

type Category = "General" | "Clientes" | "Profesionales" | "Pagos" | "Cuenta";

type Article = {
  id: string;
  category: Category;
  title: string;
  summary: string;
  keywords: string[];
  body: (highlight: (text: string) => React.ReactNode) => React.ReactNode;
};

type QuickFix = {
  title: string;
  steps: string[];
};

const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "soporte@handi.mx";
const CONTACT_POLICY_MESSAGE = getContactPolicyMessage();
const CONTACT_POLICY_MODE = getContactPolicyMode();

const categories: {
  key: Category;
  description: string;
  icon: React.ElementType;
}[] = [
  { key: "General", description: "Candado, chat y soporte", icon: Shield },
  {
    key: "Clientes",
    description: "Solicitudes y visibilidad",
    icon: HandHeart,
  },
  {
    key: "Profesionales",
    description: "Postulaciones y seguimiento",
    icon: Briefcase,
  },
  { key: "Pagos", description: "Fee inicial y acuerdos", icon: Wallet },
  { key: "Cuenta", description: "Perfil público y galería", icon: Settings },
];

const quickLinks = [
  {
    href: "/requests/new",
    label: "Crear solicitud",
    desc: "Describe el alcance y agrega fotos (límite de referencia: 5MB por imagen).",
    icon: Sparkles,
  },
  {
    href: "/applied",
    label: "Postulaciones",
    desc: "Revisa a quién aplicaste o quién aplicó a tu solicitud.",
    icon: Briefcase,
  },
  {
    href: "/profile/setup",
    label: "Configurar perfil",
    desc: "Completa datos, foto y galería para generar confianza.",
    icon: User,
  },
  {
    href: "/mensajes",
    label: "Mensajes",
    desc: "Centraliza conversación y evidencias.",
    icon: MessageCircle,
  },
  {
    href: "/privacy",
    label: "Privacidad",
    desc: "Aviso de privacidad y manejo de datos.",
    icon: ShieldCheck,
  },
  {
    href: "/politicas-facturacion",
    label: "Políticas de facturación",
    desc: "Lineamientos de cobros y comprobantes.",
    icon: Wallet,
  },
  {
    href: "/terms-and-conditions",
    label: "Términos y condiciones",
    desc: "Condiciones de uso del servicio.",
    icon: BookOpen,
  },
];

const articles: Article[] = [
  {
    id: "chat-candado",
    category: "General",
    title: "Cómo funciona el chat con candado",
    summary: CONTACT_POLICY_MESSAGE,
    keywords: [
      "candado",
      "contacto",
      "telefono",
      "correo",
      "direccion",
      "seguridad",
    ],
    body: (highlight) => (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>
          {highlight(
            "El chat bloquea o enmascara datos personales como teléfono, correo o dirección. También cuidamos enlaces que expongan esos datos para proteger a ambas partes.",
          )}
        </p>
        <Card className="bg-muted/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Mensaje activo
            </CardTitle>
            <CardDescription className="text-xs">
              {CONTACT_POLICY_MESSAGE}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            <p>{highlight(describeContactMode(CONTACT_POLICY_MODE))}</p>
          </CardContent>
        </Card>
        <p>
          {highlight(
            "Si necesitas coordinar, usa ofertas y acuerdos dentro de Handi para mantener trazabilidad y protección.",
          )}
        </p>
      </div>
    ),
  },
  {
    id: "flujo-acuerdos",
    category: "Pagos",
    title: "Flujo de acuerdos y cómo cierra la solicitud",
    summary:
      "negotiating → accepted → paid → in_progress → completed / cancelled / disputed",
    keywords: [
      "acuerdos",
      "estados",
      "negotiating",
      "in_progress",
      "completed",
      "cancelled",
      "disputed",
    ],
    body: (highlight) => (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>
          {highlight(
            "Los acuerdos pasan por negotiating → accepted → paid → in_progress → completed / cancelled / disputed. Usa estos estados para reflejar el avance real.",
          )}
        </p>
        <p>
          {highlight(
            "La solicitud suele avanzar de active a in_process cuando hay trabajo en marcha y puedes marcarla como completed o cancelled cuando cierres los acuerdos. Si hay disputa, se mantiene abierta mientras soporte revisa.",
          )}
        </p>
        <p>
          {highlight(
            "Mantén la conversación y evidencias en /mensajes para que soporte tenga contexto si algo se desvía.",
          )}
        </p>
      </div>
    ),
  },
  {
    id: "fee-inicial",
    category: "Pagos",
    title: "Fee inicial de $50 MXN con Stripe",
    summary:
      "Se cobra para avanzar seguro y habilitar datos de contacto dentro del flujo.",
    keywords: ["fee", "stripe", "50", "pago", "checkout", "contacto"],
    body: (highlight) => (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>
          {highlight(
            "Cobramos un fee inicial de $50 MXN vía Stripe para iniciar con seguridad y habilitar los datos de contacto dentro del flujo.",
          )}
        </p>
        <p>
          {highlight(
            "Stripe es el procesador de cobros. Handi recibe y liquida manualmente tras la doble confirmación (cliente y seguimiento de soporte cuando aplica). Evita reprocesar pagos duplicados; si hay duda, escribe a soporte.",
          )}
        </p>
      </div>
    ),
  },
  {
    id: "crear-solicitud",
    category: "Clientes",
    title: "Cómo crear una solicitud completa",
    summary:
      "Usa /requests/new, describe el alcance y agrega imágenes (referencia: 5MB c/u).",
    keywords: ["requests", "nueva", "imagenes", "5mb", "cliente", "adjuntos"],
    body: (highlight) => (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>
          {highlight(
            "Ve a /requests/new, agrega título, descripción, ciudad y fecha aproximada. Adjunta imágenes para dar contexto (límite de referencia: 5MB por imagen; valida el mensaje en pantalla).",
          )}
        </p>
        <p>
          {highlight(
            "Mientras más claro el alcance, más rápido recibes postulaciones útiles. Puedes ajustar después desde la misma vista de solicitud.",
          )}
        </p>
      </div>
    ),
  },
  {
    id: "visibilidad-solicitudes",
    category: "Clientes",
    title: "Quién puede ver mi solicitud",
    summary:
      "Se muestra a profesionales que coinciden con categoría y ciudad configuradas.",
    keywords: ["visibilidad", "categorias", "ciudades", "clientes"],
    body: (highlight) => (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>
          {highlight(
            "Las solicitudes se muestran a profesionales que coinciden con la categoría y ciudad que elijas. Esto reduce ruido y protege tu información.",
          )}
        </p>
        <p>
          {highlight(
            "Si necesitas restringir más, detalla el alcance y usa el chat con candado para filtrar a quien realmente puede ayudarte.",
          )}
        </p>
      </div>
    ),
  },
  {
    id: "postularse-profesional",
    category: "Profesionales",
    title: "Postularme y dar seguimiento",
    summary: "Responde desde la solicitud y revisa el estado en /applied.",
    keywords: ["postular", "profesional", "applied", "seguimiento"],
    body: (highlight) => (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>
          {highlight(
            "Abre la solicitud y usa el botón de postulación con tu mensaje inicial y propuesta.",
          )}
        </p>
        <p>
          {highlight(
            "Todo lo que postules aparece en /applied para dar seguimiento y responder dudas del cliente.",
          )}
        </p>
      </div>
    ),
  },
  {
    id: "perfil-galeria",
    category: "Cuenta",
    title: "Configurar perfil y ver mi perfil público",
    summary: "Completa /profile/setup y consulta tu perfil en /profiles/:id.",
    keywords: ["perfil", "galeria", "profile", "profiles", "publico"],
    body: (highlight) => (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>
          {highlight(
            "En /profile/setup agrega nombre, titular, ciudad, bio, años de experiencia y certificaciones opcionales. Sube fotos de trabajos para tu galería.",
          )}
        </p>
        <p>
          {highlight(
            "Tu perfil público vive en /profiles/:id; compártelo para que clientes vean tu experiencia y trabajos.",
          )}
        </p>
      </div>
    ),
  },
  {
    id: "mensajes-evidencia",
    category: "General",
    title: "Centraliza mensajes y evidencias",
    summary: "Usa /mensajes para acuerdos, fotos y soporte con contexto.",
    keywords: ["mensajes", "evidencia", "seguimiento", "soporte"],
    body: (highlight) => (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>
          {highlight(
            "Mantén la conversación en /mensajes para que soporte pueda ayudarte con contexto completo.",
          )}
        </p>
        <p>
          {highlight(
            "Agrega fotos y avances en el chat. Evita mover la conversación a canales externos.",
          )}
        </p>
      </div>
    ),
  },
];

const quickFixes: QuickFix[] = [
  {
    title: "No puedo enviar mensajes (candado)",
    steps: [
      "Revisa que tu texto no tenga teléfono, correo o dirección.",
      "Evita pegar enlaces que expongan datos personales.",
      "Intenta dividir el mensaje en pasos claros.",
      "Si sigue fallando, comparte el contexto sin datos y avisa a soporte.",
      "Guarda capturas del error para que soporte acelere la revisión.",
    ],
  },
  {
    title: "El pago del fee no se reflejó",
    steps: [
      "Confirma que Stripe finalizó el cobro (correo o estado en la app).",
      "Refresca /mensajes o la vista de acuerdos.",
      "Verifica que no haya más de una ventana abierta del checkout.",
      "Si no aparece, escribe a soporte con el correo de tu cuenta.",
      "No reproceses pagos múltiples sin confirmar con soporte.",
    ],
  },
  {
    title: "No veo mis solicitudes",
    steps: [
      "Asegúrate de haber iniciado sesión.",
      "Revisa el enlace directo de tu solicitud desde tu historial.",
      "Si fuiste redirigido, la solicitud pudo cerrarse o cancelarse.",
      "Pide al profesional que te comparta el ID si ya hay chat.",
      "Si nada carga, contacta soporte con el título de la solicitud.",
    ],
  },
  {
    title: "No puedo postularme",
    steps: [
      "Confirma que tienes perfil configurado en /profile/setup.",
      "Verifica que la solicitud sigue activa.",
      "Actualiza la página e intenta de nuevo.",
      "Si ves un error, copia el texto exacto y notifícalo.",
      "Contacta soporte desde /mensajes si necesitas ser agregado manualmente.",
    ],
  },
  {
    title: "Mis fotos no suben",
    steps: [
      "Usa imágenes JPG/PNG/WebP de máximo ~5MB como referencia.",
      "Prueba con otra red o conexión estable.",
      "Sube una foto a la vez para aislar el problema.",
      "Limpia caché o prueba en modo incógnito.",
      "Si falla, envía hora del intento y tamaño estimado a soporte.",
    ],
  },
];

export default function Help() {
  const [query, setQuery] = React.useState("");
  const [activeCategory, setActiveCategory] = React.useState<
    Category | "Todos"
  >("Todos");
  const [openItems, setOpenItems] = React.useState<string[]>([]);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredArticles = React.useMemo(() => {
    return articles.filter((article) => {
      const matchesCategory =
        activeCategory === "Todos" || article.category === activeCategory;
      if (!matchesCategory) return false;
      if (!normalizedQuery) return true;
      const haystack = [
        article.title,
        article.summary,
        article.keywords.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [activeCategory, normalizedQuery]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = decodeURIComponent(
      (window.location.hash || "").replace(/^#/, ""),
    );
    if (!hash) return;
    setOpenItems((prev) => (prev.includes(hash) ? prev : [...prev, hash]));
    const el = document.getElementById(hash);
    if (el) {
      setTimeout(() => {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    }
  }, []);

  React.useEffect(() => {
    if (!normalizedQuery) return;
    const ids = filteredArticles.map((item) => item.id);
    setOpenItems(ids);
  }, [filteredArticles, normalizedQuery]);

  const highlight = React.useCallback(
    (text: string) => highlightMatches(text, query),
    [query],
  );

  const handleCopyLink = React.useCallback((id: string) => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/help#${id}`;
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 1400);
      });
    }
  }, []);

  const accentBadges = (
    <div className="flex flex-wrap gap-2">
      <Badge variant="secondary" className="bg-white/80 text-slate-900">
        Candado: {CONTACT_POLICY_MODE}
      </Badge>
      <Badge variant="secondary" className="bg-white/80 text-slate-900">
        Stripe para cobros
      </Badge>
    </div>
  );

  return (
    <PageContainer contentClassName="max-w-6xl">
      <div className="space-y-10">
        <section className="relative overflow-hidden rounded-3xl border bg-slate-100 px-6 py-8 text-slate-900 shadow-sm dark:bg-slate-800/80">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.7),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.4),transparent_25%)] dark:bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.08),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.05),transparent_25%)]" />
          <div className="relative grid gap-8 lg:grid-cols-[1.2fr,1fr]">
            <div className="space-y-4">
              <Badge className="bg-slate-900/10 text-slate-900 backdrop-blur dark:bg-white/10 dark:text-white">
                Centro de ayuda
              </Badge>
              <h1 className="text-3xl font-semibold leading-tight md:text-4xl text-slate-900 dark:text-white">
                Ayuda Handi
              </h1>
              <p className="max-w-2xl text-base text-slate-700 dark:text-slate-100/80">
                Resuelve dudas reales de clientes y profesionales con políticas
                vigentes de candado, pagos con Stripe y flujo de acuerdos.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative w-full">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-slate-300" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar por tema, ruta o palabra clave"
                    className="h-11 bg-white/70 pl-9 text-slate-900 placeholder:text-slate-400 focus-visible:ring-offset-0 dark:bg-white/10 dark:text-white dark:placeholder:text-slate-300"
                  />
                </div>
                <Link href="/mensajes">
                  <Button
                    className="h-11 w-full bg-slate-900 text-white hover:bg-slate-800 sm:w-auto dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                    variant="secondary"
                  >
                    Abrir mensajes
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
              {accentBadges}
            </div>
            <Card className="border-slate-200 bg-white/80 text-slate-900 shadow-md backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-white">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Workflow className="h-5 w-5" />
                  Flujo de acuerdos
                </CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-200">
                  negotiating → accepted → paid → in_progress → completed /
                  cancelled / disputed
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-800 dark:text-slate-100">
                <p>
                  Avanza el acuerdo dentro de Handi para mantener trazabilidad.
                  Si hay bloqueos, escribe en /mensajes y comparte evidencia.
                </p>
                <Separator className="bg-white/60 dark:bg-white/10" />
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant="secondary"
                    className="bg-slate-900/10 text-slate-900 dark:bg-white/10 dark:text-white"
                  >
                    negotiating
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="bg-slate-900/10 text-slate-900 dark:bg-white/10 dark:text-white"
                  >
                    accepted
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="bg-slate-900/10 text-slate-900 dark:bg-white/10 dark:text-white"
                  >
                    paid
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="bg-slate-900/10 text-slate-900 dark:bg-white/10 dark:text-white"
                  >
                    in_progress
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="bg-slate-900/10 text-slate-900 dark:bg-white/10 dark:text-white"
                  >
                    completed
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="bg-slate-900/10 text-slate-900 dark:bg-white/10 dark:text-white"
                  >
                    cancelled
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="bg-slate-900/10 text-slate-900 dark:bg-white/10 dark:text-white"
                  >
                    disputed
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                Accesos rápidos
              </p>
              <h2 className="text-xl font-semibold text-slate-900">
                Tareas frecuentes
              </h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Filter className="h-4 w-4" />
              Filtra por categoría o usa el buscador
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {quickLinks.map((item) => (
              <Card
                key={item.href}
                className="h-full border-slate-200 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{item.label}</CardTitle>
                    <item.icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <CardDescription>{item.desc}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Link href={item.href}>
                    <Button
                      variant="ghost"
                      className="px-0 text-sm text-emerald-700 hover:bg-emerald-50"
                    >
                      Ir ahora
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                Categorías
              </p>
              <h2 className="text-xl font-semibold text-slate-900">
                Elige un tema para filtrar
              </h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveCategory("Todos")}
            >
              Ver todo
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {categories.map((category) => (
              <button
                key={category.key}
                onClick={() => setActiveCategory(category.key)}
                className={`group flex flex-col rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${activeCategory === category.key ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"}`}
              >
                <div className="flex items-center justify-between">
                  <category.icon
                    className={`h-5 w-5 ${activeCategory === category.key ? "text-emerald-700" : "text-muted-foreground"}`}
                  />
                  {activeCategory === category.key ? (
                    <Badge
                      variant="secondary"
                      className="bg-emerald-600 text-white"
                    >
                      Activo
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {category.key}
                </p>
                <p className="text-xs text-muted-foreground">
                  {category.description}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.7fr,1fr]">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Artículos y FAQ
                </p>
                <h2 className="text-xl font-semibold text-slate-900">
                  {filteredArticles.length} resultado
                  {filteredArticles.length === 1 ? "" : "s"}
                </h2>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setOpenItems(filteredArticles.map((item) => item.id))
                  }
                >
                  Expandir
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOpenItems([])}
                >
                  Colapsar
                </Button>
              </div>
            </div>
            <Accordion value={openItems} onValueChange={setOpenItems}>
              {filteredArticles.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">
                  No encontramos coincidencias. Prueba con otra palabra o cambia
                  de categoría.
                </div>
              ) : null}
              {filteredArticles.map((item) => (
                <AccordionItem
                  key={item.id}
                  id={item.id}
                  value={item.id}
                  title={highlight(item.title)}
                  description={highlight(item.summary)}
                  badge={<Badge variant="secondary">{item.category}</Badge>}
                  actions={
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyLink(item.id);
                      }}
                      className="text-xs"
                    >
                      {copiedId === item.id ? (
                        <>
                          <ClipboardCheck className="mr-1 h-4 w-4" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Clipboard className="mr-1 h-4 w-4" />
                          Copiar
                        </>
                      )}
                    </Button>
                  }
                >
                  {item.body(highlight)}
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>Enlace directo:</span>
                    <Link className="underline" href={`/help#${item.id}`}>
                      /help#{item.id}
                    </Link>
                  </div>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          <div className="space-y-4">
            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="h-5 w-5 text-emerald-700" />
                  Chat y seguridad
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  Datos personales protegidos. Usa el flujo dentro de Handi.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-emerald-700" />
                  <span className="font-medium text-slate-900">
                    Modo: {CONTACT_POLICY_MODE}
                  </span>
                </div>
                <p>{CONTACT_POLICY_MESSAGE}</p>
                <p className="text-xs text-muted-foreground">
                  Si necesitas compartir ubicación, hazlo dentro del chat sin
                  incluir teléfono, correo o dirección completa.
                </p>
                <Link href="/mensajes">
                  <Button variant="outline" className="w-full">
                    Ir a mensajes
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wallet className="h-5 w-5 text-emerald-700" />
                  Pagos con Stripe
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  Fee inicial de $50 MXN procesado por Stripe.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Usa la sección de acuerdos para confirmar pagos. Si algo
                  falla, no dupliques cobros y avisa a soporte.
                </p>
                <Link href="/pagos">
                  <Button
                    variant="ghost"
                    className="px-0 text-emerald-700 hover:bg-emerald-50"
                  >
                    Ver detalles de pagos
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BadgeHelp className="h-5 w-5 text-emerald-700" />
                  Soporte directo
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  Resolvemos casos con evidencias dentro de la app.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="space-y-1">
                  <p className="font-medium text-slate-900">WhatsApp</p>
                  <Link
                    className="text-emerald-700 underline"
                    href="https://wa.me/528130878691"
                  >
                    81 3087 8691
                  </Link>
                </div>
                <Separator />
                <div className="space-y-1">
                  <p className="font-medium text-slate-900">Correo</p>
                  <a
                    className="text-emerald-700 underline"
                    href={`mailto:${SUPPORT_EMAIL}?subject=Soporte Handi`}
                  >
                    {SUPPORT_EMAIL}
                  </a>
                  <div className="text-xs text-muted-foreground">
                    <Link className="underline" href="/help">
                      Centro de ayuda
                    </Link>
                  </div>
                </div>
                <Separator />
                <p className="text-xs">
                  Incluye el ID de la conversación o solicitud para acelerar la
                  revisión.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-700" />
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                Solución rápida
              </p>
              <h2 className="text-xl font-semibold text-slate-900">
                5 problemas comunes y cómo resolverlos
              </h2>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {quickFixes.map((item, index) => (
              <Card key={item.title} className="border-slate-200">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                      {index + 1}
                    </span>
                    {item.title}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  {item.steps.map((step, idx) => (
                    <div key={idx} className="flex gap-2">
                      <span className="mt-0.5 text-xs font-semibold text-emerald-700">
                        {idx + 1}.
                      </span>
                      <span>{step}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border bg-white shadow-sm">
          <div className="grid gap-6 p-6 lg:grid-cols-[2fr,1fr] lg:items-center">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                Contacto
              </p>
              <h2 className="text-2xl font-semibold text-slate-900">
                ¿Necesitas ayuda personalizada?
              </h2>
              <p className="text-sm text-muted-foreground">
                Escríbenos por el canal que prefieras. Incluye capturas, ID de
                conversación o solicitud y el error exacto que ves para
                responder más rápido.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="https://wa.me/528130878691">
                  <Button className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </Button>
                </Link>
                <a href={`mailto:${SUPPORT_EMAIL}?subject=Soporte Handi`}>
                  <Button variant="outline" className="gap-2">
                    <Mail className="h-4 w-4" />
                    {SUPPORT_EMAIL}
                  </Button>
                </a>
              </div>
            </div>
            <div className="rounded-2xl border bg-emerald-50 p-4 text-sm text-emerald-900">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                <span className="font-semibold">Recuerda</span>
              </div>
              <ul className="mt-3 space-y-1 text-emerald-900">
                <li>
                  • Mantén los datos sensibles dentro de Handi y evita
                  compartirlos completos.
                </li>
                <li>
                  • Usa el flujo de acuerdos para avanzar y cerrar trabajos.
                </li>
                <li>• Stripe procesa los cobros; guarda tu comprobante.</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </PageContainer>
  );
}

function highlightMatches(text: string, term: string): React.ReactNode {
  if (!term.trim()) return text;
  const safeTerm = escapeRegExp(term.trim());
  if (!safeTerm) return text;
  const regex = new RegExp(`(${safeTerm})`, "ig");
  const lower = term.trim().toLowerCase();
  return text.split(regex).map((part, idx) =>
    part.toLowerCase() === lower ? (
      <mark key={idx} className="rounded bg-amber-100 px-0.5 text-amber-900">
        {part}
      </mark>
    ) : (
      <React.Fragment key={idx}>{part}</React.Fragment>
    ),
  );
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function describeContactMode(
  mode: ReturnType<typeof getContactPolicyMode>,
): string {
  if (mode === "off") {
    return "Modo actual: off. No bloqueamos de forma automática, pero te pedimos evitar datos personales en mensajes.";
  }
  if (mode === "block") {
    return "Modo actual: block. Rechazamos mensajes que incluyan teléfono, correo o dirección para proteger a ambas partes.";
  }
  return "Modo actual: redact. Enmascaramos datos de contacto detectados para mantener la conversación segura.";
}
