"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type ProApplyIntroCardProps = {
  onClose: () => void;
};

const FeatureBullet = ({ children }: { children: ReactNode }) => (
  <li className="flex items-start gap-3 text-white/90 drop-shadow-[0_4px_12px_rgba(0,0,0,0.35)]">
    <span className="mt-1 inline-block h-2.5 w-2.5 rounded-full bg-[#a6d234]" />
    <span className="text-sm leading-relaxed">{children}</span>
  </li>
);

function markSeen() {
  try {
    window.localStorage.setItem("proApplyIntroSeen", "1");
  } catch {
    // ignore localStorage errors
  }
}

function ProApplyIntroCard({ onClose }: ProApplyIntroCardProps) {
  const handleClose = () => {
    markSeen();
    onClose();
  };

  return (
    <div className="relative w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
      <button
        type="button"
        onClick={handleClose}
        className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-500 shadow hover:bg-white hover:text-slate-700"
        aria-label="Cerrar"
      >
        &times;
      </button>
      <div className="grid md:grid-cols-[1.05fr_0.95fr]">
        <div className="relative hidden min-h-[520px] flex-col justify-between overflow-hidden bg-slate-900 p-10 md:flex">
          <Image
            src="/images/carpintero.png"
            alt="Profesional de Handi"
            fill
            sizes="(min-width: 768px) 640px, 100vw"
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/45 to-black/25" />
          <div className="relative z-10 space-y-5">
            <p className="text-3xl font-semibold leading-tight text-white drop-shadow-[0_6px_24px_rgba(0,0,0,0.45)]">
              Da el siguiente paso como profesional en Handi.
            </p>
            <ul className="space-y-3">
              <FeatureBullet>
                Completa tus datos y documentos con calma.
              </FeatureBullet>
              <FeatureBullet>
                Revisamos tu perfil para cuidar la calidad del servicio.
              </FeatureBullet>
              <FeatureBullet>
                Al aprobarte, podr&aacute;s recibir solicitudes y crecer.
              </FeatureBullet>
            </ul>
          </div>
          <div className="relative z-10 mt-6 h-48 w-full max-w-sm self-end drop-shadow-2xl" />
        </div>

        <div className="relative flex h-full flex-col bg-white p-6 sm:p-8">
          <div className="flex-1">
            <div className="mb-6 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0b835e]">
                ANTES DE EMPEZAR
              </p>
              <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
                Post&uacute;late como profesional en Handi
              </h2>
              <p className="text-sm text-slate-500">
                Te tomar&aacute; unos minutos. As&iacute; funciona el proceso:
              </p>
            </div>

            <ul className="space-y-3 text-sm leading-relaxed text-slate-700">
              <li>
                1) Completa este formulario con tus datos, categor&iacute;as y
                documentos.
              </li>
              <li>
                2) Nuestro equipo revisa tu informaci&oacute;n (normalmente en
                24-72 horas h&aacute;biles).
              </li>
              <li>
                3) Si todo est&aacute; correcto, te avisamos por correo para
                continuar con la activaci&oacute;n.
              </li>
              <li>
                4) Cuando est&eacute;s aprobado, podr&aacute;s recibir
                solicitudes y comenzar a trabajar con Handi.
              </li>
            </ul>

            <p className="mt-5 text-xs text-slate-500">
              Mientras revisamos tu postulaci&oacute;n, tu cuenta seguir&aacute;
              activa como usuario general.
            </p>

            <button
              type="button"
              onClick={handleClose}
              className="mt-6 w-full rounded-xl bg-[#0b835e] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0a7654]"
            >
              Entendido, comenzar
            </button>
          </div>

          <div className="mt-8 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>(c) 2025 Handi</span>
              <a href="/" className="hover:underline">
                Inicio
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProApplyIntroModal() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const seen = window.localStorage.getItem("proApplyIntroSeen");
      if (seen !== "1") setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        markSeen();
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!mounted || !open) return null;

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-2 py-4 sm:px-4 sm:py-6"
      role="dialog"
      aria-modal="true"
      aria-label="Informaci&oacute;n del proceso de postulaci&oacute;n profesional"
    >
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 z-0 bg-white/55 backdrop-blur-[4px]"
        onClick={() => {
          markSeen();
          setOpen(false);
        }}
      />
      <div className="relative z-10 w-full max-w-full md:max-w-5xl">
        <ProApplyIntroCard onClose={() => setOpen(false)} />
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modal, document.body)
    : null;
}
