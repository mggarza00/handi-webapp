"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

import { SignInFlowCard } from "./SignInFlow.client";

type HomeSignInModalProps = {
  onClose: () => void;
};

export default function HomeSignInModal({ onClose }: HomeSignInModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

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
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-full md:max-w-5xl">
        <SignInFlowCard variant="modal" onClose={onClose} />
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modal, document.body)
    : null;
}
