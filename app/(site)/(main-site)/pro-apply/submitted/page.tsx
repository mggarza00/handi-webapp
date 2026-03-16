import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";

import styles from "./page.module.css";

import ProApplySubmittedConfetti from "@/components/pro-apply/ProApplySubmittedConfetti.client";

export const metadata: Metadata = { title: "Postulación enviada" };

export default function ProApplySubmittedPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center">
      <ProApplySubmittedConfetti />

      <div
        className={`${styles["badge-pop"]} mx-auto mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200`}
      >
        🎉 Postulación enviada
      </div>

      <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-200 shadow-sm">
        <CheckCircle2
          className="h-12 w-12 text-emerald-600"
          aria-hidden="true"
        />
      </div>

      <h1 className="mb-3 text-2xl font-semibold tracking-tight">
        ¡Gracias! Estás a un paso de ser parte de Handi
      </h1>
      <p className="mx-auto mb-2 max-w-prose text-slate-700">
        Recibimos tu postulación y documentos. Nuestro equipo los revisa con
        calma para cuidar la confianza en la plataforma.
      </p>
      <p className="mx-auto mb-7 max-w-prose text-slate-600">
        Si necesitamos información extra, te escribimos.
      </p>

      <section className="mx-auto mb-8 w-full max-w-prose rounded-2xl border border-slate-200 p-4 text-left">
        <h2 className="mb-3 text-base font-semibold text-slate-900">
          ¿Qué sigue?
        </h2>
        <ul className="space-y-2 text-sm text-slate-700">
          <li className="rounded-lg bg-slate-50 px-3 py-2">✅ Recibido</li>
          <li className="rounded-lg bg-slate-50 px-3 py-2">
            🔍 Revisión de documentos (24-72 h hábiles)
          </li>
          <li className="rounded-lg bg-slate-50 px-3 py-2">
            📩 Notificación por correo
          </li>
          <li className="rounded-lg bg-slate-50 px-3 py-2">
            🚀 Activación de tu perfil
          </li>
        </ul>
      </section>

      <div className="flex items-center justify-center">
        <Link
          href="/"
          className="rounded-xl bg-slate-900 px-4 py-2 text-white shadow-sm hover:bg-black"
        >
          Ir al inicio
        </Link>
      </div>

      <p className="mx-auto mt-4 max-w-prose text-sm text-slate-600">
        Si tienes alguna duda o sugerencia comunícate con nosotros al{" "}
        <a className="underline hover:text-slate-900" href="tel:+528130878691">
          +52 81 3087 8691
        </a>{" "}
        o envíanos un correo a{" "}
        <a
          className="underline hover:text-slate-900"
          href="mailto:soporte@handi.mx"
        >
          soporte@handi.mx
        </a>
        .
      </p>
    </main>
  );
}
