import type { Metadata } from "next";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  CreditCard,
  HandHeart,
  Lock,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import React from "react";

import CreateRequestButton from "@/components/requests/CreateRequestButton";

export const metadata: Metadata = {
  title: "Pagos protegidos | Handi",
  description:
    "Conoce cómo funcionan los pagos protegidos en Handi: retenemos tu dinero hasta que confirmes el trabajo. Seguridad y confianza para clientes y profesionales.",
  alternates: { canonical: "/pagos" },
};

const steps = [
  {
    title: "Solicita el servicio",
    desc: "Define lo que necesitas y acuerda el alcance con el profesional.",
    icon: HandHeart,
  },
  {
    title: "Realizas el pago (queda retenido)",
    desc: "Pagas por adelantado; el monto se resguarda en Handi como escrow.",
    icon: CreditCard,
  },
  {
    title: "El profesional realiza el trabajo",
    desc: "Seguimiento claro y evidencia del avance en la plataforma.",
    icon: Clock3,
  },
  {
    title: "Confirmas y liberamos el pago",
    desc: "Solo se libera cuando confirmas que el trabajo se completó con éxito.",
    icon: ShieldCheck,
  },
];

const benefits = [
  {
    title: "Seguridad para el cliente",
    desc: "El dinero está protegido hasta validar el resultado.",
  },
  {
    title: "Confianza para el profesional",
    desc: "Garantía de fondos reservados antes de iniciar.",
  },
  {
    title: "Transparencia total",
    desc: "Estado de pago, hitos y liberación visibles en todo momento.",
  },
  {
    title: "Protección ante incumplimientos",
    desc: "Proceso de soporte y mediación cuando algo no sale como se acordó.",
  },
];

const faqs = [
  {
    q: "¿Qué pasa si el profesional no cumple?",
    a: "Puedes abrir un caso de soporte. Analizamos evidencias, contactamos a ambas partes y, de ser necesario, retenemos o devolvemos el pago según la resolución acordada.",
  },
  {
    q: "¿Cuándo se libera el pago?",
    a: "Solo cuando confirmas que el trabajo fue realizado como se acordó. Si no confirmas, el pago permanece retenido hasta que intervenga soporte o se cumplan las políticas de liberación.",
  },
  {
    q: "¿Qué métodos de pago se aceptan?",
    a: "Tarjeta de débito/crédito y otros métodos electrónicos disponibles en tu región. Todos pasan por pasarelas certificadas y seguras.",
  },
  {
    q: "¿Hay costos adicionales?",
    a: "No cobramos recargos sorpresa. Las comisiones o tarifas se muestran antes de pagar para que tomes una decisión informada.",
  },
];

export default function PagosPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <section className="relative overflow-hidden rounded-3xl border bg-slate-100 p-8 shadow-sm">
        <div className="relative grid gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm backdrop-blur">
              <Lock className="h-4 w-4" />
              Escrow Handi · Fondos retenidos hasta tu confirmación
            </div>
            <h1 className="text-3xl font-semibold leading-tight text-slate-900 md:text-4xl">
              Pagos 100% protegidos
            </h1>
            <p className="max-w-xl text-lg text-slate-700">
              Tu dinero queda resguardado en Handi y solo se libera cuando
              confirmas que el trabajo se realizó con éxito. Si hay algún
              problema, intervenimos con soporte y mediación.
            </p>
            <div className="flex flex-wrap gap-3 text-sm text-slate-700">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-2 shadow-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Protección para clientes y profesionales
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-2 shadow-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Liberación condicionada a confirmación
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              <CreateRequestButton className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700">
                Crear solicitud
                <ArrowRight className="h-4 w-4" />
              </CreateRequestButton>
              <Link
                href="/help#pagos"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
              >
                Ver ayuda sobre pagos
              </Link>
            </div>
          </div>
          <div className="relative">
            <div className="relative overflow-hidden rounded-2xl border bg-white p-6 shadow-md backdrop-blur">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-10 w-10 text-emerald-600" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Fondos retenidos
                  </p>
                  <p className="text-xs text-slate-500">
                    Modelo escrow para mayor seguridad
                  </p>
                </div>
              </div>
              <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-slate-100 bg-white px-4 py-3 text-sm text-slate-800">
                  <div className="flex items-center gap-2 font-semibold">
                    <Lock className="h-4 w-4 text-emerald-600" />
                    Cliente paga · Monto retenido
                  </div>
                  <p className="mt-1 text-slate-600">
                    El pago entra a reserva segura en Handi, no se envía de
                    inmediato.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-white px-4 py-3 text-sm text-slate-800">
                  <div className="flex items-center gap-2 font-semibold">
                    <Clock3 className="h-4 w-4 text-amber-600" />
                    Trabajo en proceso
                  </div>
                  <p className="mt-1 text-slate-600">
                    El profesional avanza y comparte evidencias dentro de la
                    plataforma.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-emerald-50 px-4 py-3 text-sm text-slate-900">
                  <div className="flex items-center gap-2 font-semibold">
                    <ShieldCheck className="h-4 w-4 text-emerald-700" />
                    Confirmas y liberamos
                  </div>
                  <p className="mt-1 text-slate-600">
                    Solo tras tu confirmación los fondos se liberan al
                    profesional.
                  </p>
                </div>
              </div>
              <div className="mt-6 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                En caso de conflicto, soporte y mediación intervienen para
                resolver con base en evidencias y acuerdos.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-12 space-y-6">
        <div className="flex items-center gap-2">
          <div className="h-8 w-1 rounded-full bg-emerald-500" />
          <h2 className="text-2xl font-semibold text-slate-900">
            Cómo funcionan los pagos
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, idx) => (
            <div
              key={step.title}
              className="relative flex h-full flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-sm font-semibold text-emerald-700">
                  {idx + 1}
                </span>
                <step.icon className="h-6 w-6 text-slate-500" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">
                {step.title}
              </h3>
              <p className="text-sm text-slate-600">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12 rounded-3xl border bg-slate-100 px-6 py-8 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.15em] text-emerald-700">
              Beneficios
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              Por qué este esquema es mejor para todos
            </h2>
            <p className="mt-2 max-w-2xl text-slate-700">
              Un modelo de pagos retenidos genera confianza bilateral: el
              cliente sabe que su dinero está protegido y el profesional tiene
              la certeza de que los fondos están disponibles al entregar.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-100">
            <ShieldCheck className="h-4 w-4" />
            Fondo retenido · Liberación con evidencia
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {benefits.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl bg-white p-4 ring-1 ring-slate-200"
            >
              <p className="text-sm font-semibold text-slate-900">
                {item.title}
              </p>
              <p className="mt-2 text-sm text-slate-700">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12 grid gap-8 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-1 rounded-full bg-slate-900" />
            <h2 className="text-2xl font-semibold text-slate-900">
              Preguntas frecuentes
            </h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq) => (
              <details
                key={faq.q}
                className="group rounded-2xl border bg-white p-4 shadow-sm"
                open
              >
                <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-slate-900">
                  {faq.q}
                  <span className="text-xs text-emerald-600 group-open:hidden">
                    Ver
                  </span>
                  <span className="text-xs text-emerald-600 hidden group-open:inline">
                    Ocultar
                  </span>
                </summary>
                <p className="mt-2 text-sm text-slate-700">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-4 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-10 w-10 text-emerald-600" />
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Soporte y mediación
              </p>
              <p className="text-xs text-slate-600">
                Resolvemos casos con evidencias y acuerdos claros.
              </p>
            </div>
          </div>
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
              Notifica el problema y comparte evidencia (fotos, mensajes,
              avances).
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
              Handi contacta a ambas partes, revisa el alcance y propone
              resolución.
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
              El pago se libera, ajusta o devuelve según la mediación y
              políticas.
            </li>
          </ul>
          <Link
            href="/help"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
          >
            Ir al centro de ayuda
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="mt-12 rounded-3xl border bg-white px-6 py-10 shadow-sm">
        <div className="flex flex-col gap-4 text-center">
          <h2 className="text-2xl font-semibold text-slate-900">
            Listo para usar pagos protegidos
          </h2>
          <p className="mx-auto max-w-2xl text-sm text-slate-700">
            Crea tu solicitud de servicio, reserva los fondos de forma segura y
            colabora con profesionales confiables. Si necesitas ayuda, estamos
            aquí.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <CreateRequestButton className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700">
              Crear solicitud
              <ArrowRight className="h-4 w-4" />
            </CreateRequestButton>
            <Link
              href="mailto:soporte@handi.mx?subject=Ayuda%20con%20pagos"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
            >
              Contactar soporte
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
