"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Sentry from "@sentry/nextjs";

import PageContainer from "@/components/page-container";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  React.useEffect(() => {
    console.error("App Error:", error);
    Sentry.captureException(error, {
      tags: {
        route: pathname || "unknown",
      },
      extra: {
        digest: error?.digest,
      },
    });
  }, [error, pathname]);

  // In App Router, error.tsx is rendered inside the nearest layout.
  // It should NOT render <html> or <body> — only the content.
  return (
    <PageContainer>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Ocurrió un error</h1>
        <p className="text-sm text-slate-600">
          Intenta recargar la página o vuelve al inicio.
        </p>
        <div className="flex gap-3 text-sm">
          <button className="underline" onClick={() => reset()}>
            Reintentar
          </button>
          <Link className="underline" href="/">
            Ir al inicio
          </Link>
        </div>
      </div>
    </PageContainer>
  );
}
