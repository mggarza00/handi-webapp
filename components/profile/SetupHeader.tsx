import React from "react";

export default function SetupHeader({ isPro }: { isPro: boolean }) {
  return (
    <header className="space-y-1">
      <h1 className="text-2xl font-semibold">
        {isPro ? "Configura tu perfil de profesional" : "Configura tu perfil"}
      </h1>
      <p className="text-sm text-slate-600">
        Tus cambios serán revisados por el equipo antes de publicarse.
      </p>
    </header>
  );
}

