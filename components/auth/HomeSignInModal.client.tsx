"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { SignInFlowCard } from "./SignInFlow.client";

export default function HomeSignInModal() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
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
      aria-label="Iniciar sesión o crear cuenta"
    >
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 z-0 bg-white/55 backdrop-blur-[4px]"
        onClick={() => setOpen(false)}
      />
      <div className="relative z-10 w-full max-w-full md:max-w-5xl">
        <SignInFlowCard variant="modal" onClose={() => setOpen(false)} />
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modal, document.body) : null;
}
