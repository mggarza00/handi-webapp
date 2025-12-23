"use client";
import { useEffect } from "react";

export default function ErrorClientProfile({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Optional: log to monitoring
    // eslint-disable-next-line no-console
    console.error("/clients/[id] error:", error);
  }, [error]);

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-semibold">Perfil del cliente</h1>
      <p className="mt-3 text-sm text-red-600">Ocurrió un error al cargar la página.</p>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex items-center rounded-md bg-black px-3 py-1.5 text-white hover:bg-neutral-800"
        >
          Reintentar
        </button>
        <a href="/" className="text-sm text-slate-700 hover:underline">Volver al inicio</a>
      </div>
    </main>
  );
}

