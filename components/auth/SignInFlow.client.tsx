"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import EmailPasswordForm from "@/components/auth/EmailPasswordForm";
import {
  EXPIRED_AUTH_LINK_MESSAGE,
  isExpiredOrUsedAuthLink,
} from "@/lib/auth/flow";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { trackLoginCompleted } from "@/lib/analytics/track";
import { normalizeAppError } from "@/lib/errors/app-error";
import { reportError } from "@/lib/errors/report-error";
import { createSupabaseBrowser } from "@/lib/supabase/client";

const stackSansMedium = {
  className:
    '"Stack Sans Text", system-ui, -apple-system, "Segoe UI", "Helvetica Neue", sans-serif',
};
type Step = "method" | "email";

type SignInFlowCardProps = {
  onClose?: () => void;
  variant?: "modal" | "page";
};

const FeatureBullet = ({ children }: { children: ReactNode }) => (
  <li className="flex items-start gap-3 text-white/90 drop-shadow-[0_4px_12px_rgba(0,0,0,0.35)]">
    <span className="mt-1 inline-block h-2.5 w-2.5 rounded-full bg-[#a6d234]" />
    <span className="text-sm leading-relaxed">{children}</span>
  </li>
);

export function SignInFlowCard({
  onClose,
  variant = "page",
}: SignInFlowCardProps) {
  const router = useRouter();
  const sp = useSearchParams();
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const [step, setStep] = useState<Step>("method");
  const [error, setError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [callbackRecoveryMessage, setCallbackRecoveryMessage] = useState<
    string | null
  >(null);

  const next = useMemo(() => {
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

  const prefilledEmail = useMemo(() => {
    const email = (sp?.get("email") || "").trim();
    if (!email) return "";
    return email;
  }, [sp]);

  const resolveBaseUrl = useCallback(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin.replace(/\/$/, "");
  }, []);

  useEffect(() => {
    const err = sp?.get("error");
    const code = sp?.get("code");
    const status = sp?.get("status");
    const authLink = sp?.get("auth_link");

    if (
      isExpiredOrUsedAuthLink({
        status,
        code,
        error: err,
        authLink,
      })
    ) {
      setStep("email");
      setError(null);
      setCallbackRecoveryMessage(EXPIRED_AUTH_LINK_MESSAGE);
      return;
    }

    setCallbackRecoveryMessage(null);
    if (!err) return;

    if (
      code === "over_request_rate_limit" ||
      status === "429" ||
      /rate limit/i.test(err)
    ) {
      setError(
        "Demasiados intentos al iniciar sesion. Espera 1-2 minutos e intentalo de nuevo.",
      );
    } else {
      const normalized = normalizeAppError(err, {
        status: status ? Number(status) : undefined,
        source: "auth.sign-in.callback",
        code,
      });
      setError(normalized.userMessage);
      reportError({
        error: err,
        normalized,
        area: "auth",
        feature: "sign-in-callback",
        route: "/auth/sign-in",
        blocking: true,
        extra: { callbackStatus: status, callbackCode: code },
      });
    }
  }, [sp]);

  useEffect(() => {
    if (!sessionChecked || hasSession) return;
    const t = sp?.get("toast");
    if (t === "new-request") {
      toast.info("Inicia sesion para crear una solicitud de servicio");
    } else if (t === "pro-apply") {
      toast.info("Inicia sesion para postularte como profesional");
    }
  }, [sp, sessionChecked, hasSession]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        const authed = !!data?.session;
        setHasSession(authed);
        setSessionChecked(true);
        if (authed) {
          const fromAuthCallback = Boolean(
            sp?.get("code") || sp?.get("auth_link"),
          );
          if (fromAuthCallback) {
            trackLoginCompleted({
              method: "google",
              user_type: "client",
              source_page: "/auth/sign-in",
            });
          }
          router.replace(next);
          router.refresh();
          onClose?.();
        }
      } catch {
        if (active) setSessionChecked(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [next, onClose, router, sp, supabase]);

  const goToEmailStep = () => {
    setStep("email");
    setError(null);
  };

  const handleGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    const base = resolveBaseUrl();
    try {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${base}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
    } catch (err) {
      setGoogleLoading(false);
      const normalized = normalizeAppError(err, {
        source: "auth.sign-in.google",
      });
      setError(normalized.userMessage);
      reportError({
        error: err,
        normalized,
        area: "auth",
        feature: "google-sign-in",
        route: "/auth/sign-in",
        blocking: true,
      });
    }
  };

  const showCloseButton = typeof onClose === "function";
  const isModal = variant === "modal";

  return (
    <div className="relative w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
      {showCloseButton ? (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-500 shadow hover:bg-white hover:text-slate-700"
          aria-label="Cerrar"
        >
          X
        </button>
      ) : null}
      <div className="grid md:grid-cols-[1.05fr_0.95fr]">
        <div className="relative hidden min-h-[520px] flex-col justify-between overflow-hidden bg-slate-900 p-10 md:flex">
          <Image
            src="/images/ica-blog-hero-how-a-handyman-can-add-home-inspection.jpg"
            alt="Profesionales Handi listos para ayudarte"
            fill
            sizes="(min-width: 768px) 640px, 100vw"
            className="object-cover"
            priority={isModal}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/45 to-black/25" />
          <div className="relative z-10 space-y-6">
            <p
              className={`${stackSansMedium.className} text-3xl font-semibold leading-tight text-white drop-shadow-[0_6px_24px_rgba(0,0,0,0.45)]`}
            >
              Conecta con expertos de confianza.
            </p>
            <ul className="space-y-3">
              <FeatureBullet>
                Categorias desde mantenimiento hasta cuidado para personas.
              </FeatureBullet>
              <FeatureBullet>
                Expertos certificados y aprobados por Handi.
              </FeatureBullet>
              <FeatureBullet>Pagos 100% protegidos.</FeatureBullet>
            </ul>
          </div>
          <div className="relative z-10 mt-6 h-48 w-full max-w-sm self-end drop-shadow-2xl" />
        </div>

        <div className="relative flex h-full flex-col bg-white p-6 sm:p-8">
          <div className="flex-1">
            <div className="mb-6 space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0b835e]">
                Paso {step === "method" ? "1" : "2"} de 2
              </p>
              <h2 className="text-2xl font-semibold text-slate-900">
                Inicia sesion o crea tu cuenta
              </h2>
              <p className="text-sm text-slate-500">
                Selecciona como quieres continuar
              </p>
            </div>

            {step === "method" ? (
              <div className="space-y-3">
                <Button
                  variant="outline"
                  onClick={handleGoogle}
                  disabled={googleLoading}
                  className="w-full rounded-xl border-slate-200 py-6 text-base"
                >
                  {googleLoading ? (
                    <Spinner />
                  ) : (
                    <Image
                      src="/icons/google.svg"
                      width={20}
                      height={20}
                      alt=""
                      aria-hidden
                    />
                  )}
                  <span className="ml-2 font-medium">
                    {googleLoading ? "Redirigiendo..." : "Continuar con Google"}
                  </span>
                </Button>
                <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
                  <span className="h-px flex-1 bg-slate-200" />
                  <span className="px-2 text-slate-500">O</span>
                  <span className="h-px flex-1 bg-slate-200" />
                </div>
                <Button
                  onClick={goToEmailStep}
                  className="w-full rounded-xl bg-[#0b835e] py-6 text-base font-semibold hover:bg-[#0a7654]"
                >
                  Continuar con el correo electronico
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <EmailPasswordForm
                  next={next}
                  onAuthSuccess={onClose}
                  initialEmail={prefilledEmail}
                  externalRecoveryMessage={callbackRecoveryMessage}
                />

                <div className="flex items-center justify-between text-sm text-slate-500">
                  <button
                    type="button"
                    className="font-medium text-[#0b835e] hover:text-[#086545]"
                    onClick={() => {
                      setStep("method");
                      setError(null);
                    }}
                  >
                    Volver y elegir otro metodo
                  </button>
                  {variant === "page" ? (
                    <a href="/" className="hover:underline">
                      Volver al inicio
                    </a>
                  ) : null}
                </div>
              </div>
            )}

            {step === "method" && error ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}
          </div>
          <div className="mt-8 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>(c) 2025 Handi</span>
              <a href="/" className="hover:underline">
                Inicio
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
