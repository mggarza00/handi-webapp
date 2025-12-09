"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export default function SignInPage() {
  const supabase = createSupabaseBrowser();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [facebookLoading, setFacebookLoading] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const sp = useSearchParams();
  // Surface OAuth errors (e.g., over_request_rate_limit) from /auth/callback redirect
  useEffect(() => {
    const err = sp?.get("error");
    const code = sp?.get("code");
    const status = sp?.get("status");
    if (err) {
      if (code === "over_request_rate_limit" || status === "429" || /rate limit/i.test(err)) {
        setError("Demasiados intentos al iniciar sesión. Espera 1–2 minutos e inténtalo de nuevo, o usa el enlace por correo.");
      } else {
        setError(err);
      }
    }
  }, [sp]);
  // Optional toast guidance for flows arriving from CTA (only when not authenticated)
  useEffect(() => {
  if (!sessionChecked || hasSession) return;
  const t = sp?.get("toast");
  if (t === "new-request") {
    toast.info("Inicia sesión para crear una solicitud de servicio");
  } else if (t === "pro-apply") {
    toast.info("Inicia sesión para postularte como profesional");
  }
}, [sp, sessionChecked, hasSession]);  const next = useMemo(() => {
    const n = sp?.get("next");
    if (n && n.startsWith("/")) return n;
    if (typeof window !== "undefined") {
      try {
        const rt = window.localStorage.getItem("returnTo");
        if (rt && rt.startsWith("/")) return rt;
      } catch {
        /* ignore */
      }
    }
    return "/";
  }, [sp]);

  const resolveBaseUrl = () => window.location.origin.replace(/\/$/, "");

  // If already authenticated, skip this page and go to `next`
    // If already authenticated, skip this page and go to `next`; mark session state
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const authed = !!data?.session;
        setHasSession(authed);
        setSessionChecked(true);
        if (authed) {
          router.replace(next);
          router.refresh();
        }
      } catch {
        setSessionChecked(true);
      }
    })();
  }, [next, router, supabase]);  const handleGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    const base = window.location.origin.replace(/\/$/, "");
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${base}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  };
const handleFacebook = async () => {
    setError(null);
    setFacebookLoading(true);
    const base = resolveBaseUrl();
    await supabase.auth.signInWithOAuth({
      provider: "facebook",
      options: {
        redirectTo: `${base}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSent(false);
    setSending(true);
    try {
      const base = resolveBaseUrl();
      const pwd = password.trim();
      if (pwd.length > 0) {
        const { error: passwordError } = await supabase.auth.signInWithPassword({
          email,
          password: pwd,
        });
        if (passwordError) throw passwordError;
        setPassword("");
        router.replace(next);
        router.refresh();
        return;
      }

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${base}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (otpError) throw otpError;
      setSent(true);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : typeof err === "string"
          ? err
          : "Error al iniciar sesión",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl shadow p-6 border bg-white dark:bg-neutral-900">
        <h1 className="text-2xl font-semibold mb-2">Iniciar sesión</h1>
        <p className="text-sm text-neutral-500 mb-6">
          Entra con Google o Facebook, o recibe un enlace mágico por correo.
        </p>

        <Button
          variant="outline"
          onClick={handleGoogle}
          disabled={googleLoading || facebookLoading || sending}
          className="w-full rounded-xl mb-4"
        >
          {googleLoading ? (
            <Spinner />
          ) : (
            <Image src="/icons/google.svg" width={18} height={18} alt="" />
          )}
          <span>{googleLoading ? "Redirigiendo" : "Ingresar con Google"}</span>
        </Button>

        <Button
          onClick={handleFacebook}
          disabled={googleLoading || facebookLoading || sending}
          className="w-full rounded-xl mb-4 bg-[#1877F2] text-white hover:bg-[#1877F2]/90"
        >
          {facebookLoading ? (
            <Spinner />
          ) : (
            <Image src="/icons/facebook.svg" width={18} height={18} alt="" />
          )}
          <span>{facebookLoading ? "Redirigiendo" : "Ingresar con Facebook"}</span>
        </Button>

        <div className="text-xs uppercase tracking-wide text-neutral-400 text-center my-4">
          o con tu correo
        </div>

        {sent ? (
          <div className="text-sm text-green-600">
            Te enviamos un enlace de acceso. Revisa tu correo.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              data-testid="email"
              type="email"
              required
              pattern="^[^@\s]+@[^@\s]+\.[^@\s]+$"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tucorreo@ejemplo.com"
              className="w-full rounded-xl border px-4 py-2"
              autoComplete="email"
            />
            <input
              data-testid="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña (opcional)"
              className="w-full rounded-xl border px-4 py-2"
              autoComplete="current-password"
            />
            <Button
              data-testid="sign-in-btn"
              type="submit"
              disabled={sending || googleLoading || facebookLoading}
              className="w-full rounded-xl"
            >
              {sending ? (
                <>
                  <Spinner />
                  <span>Enviando</span>
                </>
              ) : password.trim().length > 0 ? (
                "Iniciar sesión"
              ) : (
                "Enviar enlace"
              )}
            </Button>
          </form>
        )}

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

        <div className="mt-6 border-t pt-4 text-xs text-neutral-500">
          <div className="flex items-center justify-between">
            <span>(c) {new Date().getFullYear()} Handi</span>
            <a href="/" className="hover:underline">Inicio</a>
          </div>
        </div>
      </div>
    </div>
  );
}






