"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import NewRequestStepper from "@/components/requests/NewRequestStepper";

export type NewRequestStepperModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (newId?: string) => void;
  initialAddress?: {
    address: string;
    lat?: number | null;
    lon?: number | null;
  };
};

export default function NewRequestStepperModal({ open, onOpenChange, onSuccess, initialAddress }: NewRequestStepperModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return undefined;
    const body = document.body;
    if (!body) return undefined;
    if (open) {
      body.classList.add("overflow-hidden");
    } else {
      body.classList.remove("overflow-hidden");
    }
    return () => {
      body.classList.remove("overflow-hidden");
    };
  }, [open, mounted]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-hidden
      />
      <div
        className="relative z-10 flex min-h-screen items-center justify-center px-4 sm:px-6"
        onClick={() => onOpenChange(false)}
      >
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpenChange(false);
          }}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white transition hover:bg-black/80"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
        <div
          role="dialog"
          aria-modal="true"
          className="w-full max-w-5xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-3xl"
          onClick={(event) => event.stopPropagation()}
        >
          <NewRequestStepper
            showStatus={false}
            initialAddress={initialAddress}
            onSuccess={(newId) => {
              onSuccess?.(newId);
              onOpenChange(false);
            }}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
