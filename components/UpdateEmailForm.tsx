"use client";

import { useState } from "react";

import { supabaseBrowser } from "@/lib/supabase-browser";

export default function UpdateEmailForm({ currentEmail }: { currentEmail: string | null }) {
  const [email, setEmail] = useState<string>(currentEmail ?? "");
  const [status, setStatus] = useState<null | { type: "ok" | "err"; msg: string }>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setStatus({ type: "err", msg: "Correo inválido" });
      return;
    }
    setLoading(true);
    try {
      const emailRedirectTo = `${window.location.origin}/auth/callback?next=/me`;
      const { error } = await supabaseBrowser.auth.updateUser({ email }, { emailRedirectTo });
      if (error) throw error;
      setStatus({ type: "ok", msg: "Te enviamos un enlace de confirmación al nuevo correo." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : typeof err === "string" ? err : "Ocurrió un error";
      setStatus({ type: "err", msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-medium">Actualizar email</h2>
      <p className="mt-1 text-sm text-slate-600">Confirma el cambio mediante un enlace que enviaremos.</p>
      <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          pattern="^[^@\s]+@[^@\s]+\.[^@\s]+$"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border px-3 py-2"
          placeholder="tu-correo@ejemplo.com"
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded bg-black px-4 py-2 text-white disabled:opacity-60"
        >
          {loading ? "Actualizando…" : "Actualizar"}
        </button>
      </form>
      {status ? (
        <p className={`mt-2 text-sm ${status.type === "ok" ? "text-green-600" : "text-red-600"}`}>{status.msg}</p>
      ) : null}
    </div>
  );
}
