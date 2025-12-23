"use client";
import * as React from "react";

export default function ShareButton({ title }: { title: string }) {
  function onClick() {
    if (typeof navigator !== "undefined" && (navigator as Navigator & { share?: (data: { url?: string; title?: string }) => Promise<void> }) ?.share) {
      (navigator as Navigator & { share?: (data: { url?: string; title?: string }) => Promise<void> })
        .share({
          url: typeof window !== "undefined" ? window.location.href : "",
          title,
        })
        .catch(() => {});
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(
        typeof window !== "undefined" ? window.location.href : "",
      );
    }
  }
  return (
    <button
      type="button"
      className="inline-flex items-center rounded-md border border-slate-200 px-4 py-2 text-slate-700 hover:bg-slate-50"
      onClick={onClick}
    >
      Compartir
    </button>
  );
}


