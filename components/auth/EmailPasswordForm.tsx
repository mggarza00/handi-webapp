"use client";

import { useCallback, useEffect, useState } from "react";

import type { EmailAuthMode } from "./useEmailPasswordAuth";
import { useEmailPasswordAuth } from "./useEmailPasswordAuth";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { isBlockedDomain } from "@/lib/utils/validateEmailDomain";

type PasswordRequirement = { label: string; pass: boolean };

type EmailPasswordFormProps = {
  next: string;
  initialEmail?: string;
  onAuthSuccess?: () => void;
  showTitle?: boolean;
};

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const buildPasswordRequirements = (password: string): PasswordRequirement[] => [
  { label: "Al menos 8 caracteres", pass: password.length >= 8 },
  { label: "Al menos 1 letra mayúscula", pass: /[A-Z]/.test(password) },
  { label: "Al menos 1 letra minúscula", pass: /[a-z]/.test(password) },
  { label: "Al menos 1 número", pass: /\d/.test(password) },
];

export default function EmailPasswordForm({
  next,
  initialEmail = "",
  onAuthSuccess,
  showTitle = false,
}: EmailPasswordFormProps) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<EmailAuthMode | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);
  const [resetting, setResetting] = useState(false);

  const { loading: authLoading, submit } = useEmailPasswordAuth({ next, onAuthSuccess });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const emailLooksValid = isValidEmail(email);
  const requirements = buildPasswordRequirements(password);

  useEffect(() => {
    setMode(null);
    setInfo(null);
    setPendingConfirmation(false);
  }, [email]);

  const determineMode = useCallback(async (): Promise<EmailAuthMode | null> => {
    if (!emailLooksValid) {
      setMode(null);
      return null;
    }
    if (email.trim().length < 6 || isBlockedDomain(email)) {
      setError(
        "Usa un correo válido y evita dominios genéricos (ej: test.com, example.com, mailinator.com).",
      );
      setMode(null);
      return null;
    }
    setCheckingEmail(true);
    try {
      const res = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({ exists: false }));
      const exists = Boolean(data?.exists);
      const nextMode: EmailAuthMode = exists ? "login" : "signup";
      setMode(nextMode);
      return nextMode;
    } catch {
      setMode(null);
      return null;
    } finally {
      setCheckingEmail(false);
    }
  }, [email, emailLooksValid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authLoading) return;
    if (!email.trim()) {
      setError("Por favor ingresa tu correo electrónico.");
      return;
    }
    if (!emailLooksValid || email.trim().length < 6 || isBlockedDomain(email)) {
      setError(
        "Usa un correo válido y evita dominios genéricos (ej: test.com, example.com, mailinator.com).",
      );
      return;
    }
    setError(null);
    setInfo(null);
    setPendingConfirmation(false);

    let targetMode = mode;
    if (!targetMode) {
      targetMode = await determineMode();
    }
    if (!targetMode) {
      setError("Ingresa un correo válido para continuar.");
      return;
    }
    if (!password.trim()) {
      setError("Ingresa tu contraseña para continuar.");
      return;
    }

    const result = await submit(targetMode, email.trim(), password);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.pendingEmailConfirmation) {
      setPendingConfirmation(true);
      setInfo("Te enviamos un enlace para confirmar tu cuenta. Revisa tu correo.");
    }
  };

  const handleForgotPassword = async () => {
    const trimmed = email.trim();
    console.log("Forgot password clicked", trimmed);
    if (!trimmed) {
      setError("Por favor escribe tu correo para enviarte el enlace de recuperación.");
      setSuccessMessage(null);
      return;
    }
    if (!isValidEmail(trimmed) || trimmed.length < 6 || isBlockedDomain(trimmed)) {
      setError(
        "Usa un correo válido y evita dominios genéricos (ej: test.com, example.com, mailinator.com).",
      );
      setSuccessMessage(null);
      return;
    }
    setResetting(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/auth/send-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });

      const data = (await res.json().catch(() => null)) as
        | { success?: boolean; error?: string; message?: string }
        | null;

      if (!res.ok || data?.success !== true) {
        console.error("Error from send-password-reset endpoint:", res.status, data);
        setError(
          data?.message ||
            data?.error ||
            "No pudimos enviar el correo de recuperación. Inténtalo de nuevo en unos minutos.",
        );
        setSuccessMessage(null);
        return;
      }

      console.log("Reset password request sent");
      setSuccessMessage(
        "Te enviamos un correo con un enlace para restablecer tu contraseña. Revisa también tu carpeta de spam o promociones.",
      );
      setError(null);
    } catch (err) {
      console.error("Unexpected error sending reset password:", err);
      setError(
        "Ocurrió un error inesperado al enviar el correo. Inténtalo de nuevo más tarde.",
      );
      setSuccessMessage(null);
    } finally {
      setResetting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {showTitle ? (
        <div className="space-y-1.5">
          <h3 className="text-xl font-semibold text-slate-900">Accede con tu correo</h3>
          <p className="text-sm text-slate-500">
            Ingresa tu correo y contraseña para continuar. Si es tu primera vez, crea tu clave.
          </p>
        </div>
      ) : null}

      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700" htmlFor="email">
          Correo electrónico
        </label>
        <input
          id="email"
          data-testid="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => {
            void determineMode();
          }}
          placeholder="tucorreo@ejemplo.com"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm shadow-sm focus:border-[#0b835e] focus:outline-none"
          autoComplete="email"
        />
        {checkingEmail ? (
          <p className="text-xs text-slate-500">Verificando correo...</p>
        ) : null}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700" htmlFor="password">
          Contraseña
        </label>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 shadow-sm focus-within:border-[#0b835e]">
          <input
            id="password"
            data-testid="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Ingresa tu contraseña"
            className="w-full bg-transparent px-1 py-1 text-sm focus:outline-none"
            autoComplete="current-password"
          />
          <button
            type="button"
            className="text-xs font-medium text-[#0b835e] hover:text-[#086545]"
            onClick={() => setShowPassword((s) => !s)}
          >
            {showPassword ? "Ocultar" : "Mostrar"}
          </button>
        </div>
        <button
          type="button"
          className="text-xs font-semibold text-[#0b835e] hover:text-[#086545]"
          onClick={() => {
            if (!resetting) void handleForgotPassword();
          }}
          disabled={resetting}
        >
          {resetting ? (
            <span className="inline-flex items-center gap-1">
              <Spinner className="h-3.5 w-3.5" />
              Enviando enlace...
            </span>
          ) : (
            "¿Olvidaste tu contraseña?"
          )}
        </button>
      </div>

      {successMessage ? (
        <p className="text-sm text-green-700">{successMessage}</p>
      ) : null}

      {mode === "signup" ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="mb-2 text-sm font-semibold text-slate-700">Requisitos de contraseña</p>
          <ul className="space-y-1.5 text-sm">
            {requirements.map((req) => (
              <li
                key={req.label}
                className={`flex items-center gap-2 ${req.pass ? "text-[#0b835e]" : "text-slate-600"}`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full border text-xs ${
                    req.pass
                      ? "border-[#0b835e] bg-[#0b835e]/10 text-[#0b835e]"
                      : "border-slate-300 bg-white text-slate-400"
                  }`}
                  aria-hidden
                >
                  {req.pass ? "✓" : "•"}
                </span>
                <span>{req.label}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Button
        data-testid="sign-in-btn"
        type="submit"
        disabled={authLoading || checkingEmail}
        className="w-full rounded-xl py-3 font-semibold"
      >
        {authLoading ? (
          <>
            <Spinner />
            <span className="ml-2">Enviando</span>
          </>
        ) : mode === "login" ? (
          "Iniciar sesión"
        ) : mode === "signup" ? (
          "Crear cuenta"
        ) : (
          "Continuar"
        )}
      </Button>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {info ? <p className="text-sm text-slate-600">{info}</p> : null}
      {pendingConfirmation ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Te enviamos un enlace para confirmar tu cuenta. Revisa tu correo.
        </div>
      ) : null}
    </form>
  );
}
