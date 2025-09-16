"use client";
import * as React from "react";

export default function TypingIndicator({ label = "Escribiendo" }: { label?: string }) {
  const [dots, setDots] = React.useState(".");
  React.useEffect(() => {
    const id = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "." : d + "."));
    }, 400);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="px-3 py-1 text-[12px] text-slate-500 select-none" role="status" aria-live="polite">
      {label}
      <span className="inline-block w-4 text-left">{dots}</span>
    </div>
  );
}

