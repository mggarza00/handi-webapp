import { notFound } from "next/navigation";

import SentryTest from "./SentryTest.client";

export const dynamic = "force-dynamic";

export default function SentryTestPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-4">
      <h1 className="text-2xl font-semibold">Sentry test (dev only)</h1>
      <p className="text-sm text-slate-600">
        Usa este boton para enviar un error de prueba a Sentry en local.
      </p>
      <SentryTest />
    </div>
  );
}
