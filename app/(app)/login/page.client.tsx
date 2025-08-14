"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const search = useSearchParams();

  useEffect(() => {
    const e = search.get("e");
    if (e) setMsg(decodeURIComponent(e));
  }, [search]);

  function loginGoogle() {
    // Inicia OAuth desde el servidor (guarda PKCE en cookies)
    window.location.href = "/auth/sign-in";
  }

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabaseBrowser.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setMsg(error ? error.message : "Te enviamos un enlace de acceso a tu correo.");
  }

  return (
    <div className="max-w-sm mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">Iniciar sesión</h1>

      {msg && (
        <p className="text-sm p-2 rounded border bg-gray-50">
          {msg}
        </p>
      )}

      <button
        onClick={loginGoogle}
        className="w-full border rounded px-3 py-2"
      >
        Continuar con Google
      </button>

      <div className="text-center text-sm opacity-70">o</div>

      <form onSubmit={sendOtp} className="space-y-3">
        <input
          type="email"
          className="w-full border rounded px-3 py-2"
          placeholder="tu@correo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button className="w-full border rounded px-3 py-2">
          Enviar magic link
        </button>
      </form>
    </div>
  );
}
