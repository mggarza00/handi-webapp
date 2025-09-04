"use client";
import * as React from "react";
import Link from "next/link";

import PageContainer from "@/components/page-container";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    console.error("App Error:", error);
  }, [error]);

  return (
    <html lang="es">
      <body>
        <PageContainer>
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold">Ocurrió un error</h1>
            <p className="text-sm text-slate-600">Intenta recargar la página o vuelve al inicio.</p>
            <div className="flex gap-3 text-sm">
              <button className="underline" onClick={() => reset()}>Reintentar</button>
              <Link className="underline" href="/">Ir al inicio</Link>
            </div>
          </div>
        </PageContainer>
      </body>
    </html>
  );
}

