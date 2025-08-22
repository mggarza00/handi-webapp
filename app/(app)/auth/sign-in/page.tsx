'use client';

import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function SignInPage() {
  const supabase = createClientComponentClient();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogle = async () => {
    setError(null);
    const origin = window.location.origin;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${origin}/auth/callback?next=/` }
    });
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      const origin = window.location.origin;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${origin}/auth/callback?next=/` }
      });
      if (error) throw error;
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : (typeof err === "string" ? err : "Error al enviar el enlace"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl shadow p-6 border bg-white dark:bg-neutral-900">
        <h1 className="text-2xl font-semibold mb-2">Iniciar sesión</h1>
        <p className="text-sm text-neutral-500 mb-6">
          Entra con Google o recibe un enlace mágico por correo.
        </p>

        <button
          onClick={handleGoogle}
          className="w-full rounded-2xl px-4 py-2 mb-4 border shadow hover:shadow-md transition"
        >
          Entrar con Google
        </button>

        <div className="text-xs uppercase tracking-wide text-neutral-400 text-center my-4">
          o con tu correo
        </div>

        {sent ? (
          <div className="text-sm text-green-600">
            Te enviamos un enlace de acceso. Revisa tu correo.
          </div>
        ) : (
          <form onSubmit={handleEmail} className="space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tucorreo@ejemplo.com"
              className="w-full rounded-2xl border px-4 py-2"
            />
            <button
              type="submit"
              disabled={sending}
              className="w-full rounded-2xl px-4 py-2 bg-black text-white hover:opacity-90 disabled:opacity-60"
            >
              {sending ? 'Enviando…' : 'Enviar enlace'}
            </button>
          </form>
        )}

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      </div>
    </div>
  );
}
