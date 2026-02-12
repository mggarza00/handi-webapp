"use client";

import * as Sentry from "@sentry/nextjs";
import { useState } from "react";

export default function SentryTest() {
  const [sent, setSent] = useState(false);

  return (
    <button
      type="button"
      className="inline-flex items-center rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
      onClick={() => {
        const err = new Error("Sentry test: client");
        Sentry.captureException(err);
        setSent(true);
        throw err;
      }}
    >
      {sent ? "Error enviado" : "Lanzar error de prueba"}
    </button>
  );
}
