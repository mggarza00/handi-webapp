"use client";
import * as React from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Log to console for easier debugging in dev
    console.error("Global Error:", error);
  }, [error]);

  return (
    <html lang="es">
      <body>
        <div style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
          <h1 style={{ fontWeight: 600, fontSize: 20 }}>Ocurrió un error</h1>
          <p style={{ color: "#475569", fontSize: 14, marginTop: 8 }}>
            El servidor no pudo completar esta sección. Intentaremos
            renderizar del lado del cliente.
          </p>
          {error?.message ? (
            <pre
              style={{
                marginTop: 12,
                background: "#f8fafc",
                padding: 12,
                borderRadius: 8,
                fontSize: 12,
                overflow: "auto",
              }}
            >
              {error.message}
              {error.digest ? `\n\nDigest: ${error.digest}` : ""}
            </pre>
          ) : null}
          <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
            <button
              onClick={() => reset()}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #0f172a",
                background: "#0f172a",
                color: "white",
              }}
            >
              Reintentar
            </button>
            <a href="/" style={{ textDecoration: "underline", fontSize: 14 }}>
              Ir al inicio
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}

