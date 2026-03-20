"use client";

import { useCallback, useEffect, useState } from "react";

import { requestResendConfirmation } from "./recovery-actions";
import type { EmailAuthMode } from "./useEmailPasswordAuth";
import { useEmailPasswordAuth } from "./useEmailPasswordAuth";

import {
  PASSWORD_RESET_SENT_MESSAGE,
  SIGNUP_CONFIRMATION_MESSAGE,
  getLoginErrorPresentation,
  isValidEmailForRecovery,
} from "@/lib/auth/flow";
import { isValidPersonName, normalizePersonName } from "@/lib/auth/user-name";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { isBlockedDomain } from "@/lib/utils/validateEmailDomain";

type PasswordRequirement = { label: string; pass: boolean };

type EmailPasswordFormProps = {
  next: string;
  initialEmail?: string;
  onAuthSuccess?: () => void;
  showTitle?: boolean;
  externalRecoveryMessage?: string | null;
};

const buildPasswordRequirements = (password: string): PasswordRequirement[] => [
  { label: "Al menos 8 caracteres", pass: password.length >= 8 },
  { label: "Al menos 1 letra mayuscula", pass: /[A-Z]/.test(password) },
  { label: "Al menos 1 letra minuscula", pass: /[a-z]/.test(password) },
  { label: "Al menos 1 numero", pass: /\d/.test(password) },
];

export default function EmailPasswordForm({
  next,
  initialEmail = "",
  onAuthSuccess,
  showTitle = false,
  externalRecoveryMessage = null,
}: EmailPasswordFormProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<EmailAuthMode | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resendingConfirmation, setResendingConfirmation] = useState(false);
  const [showRecoveryActions, setShowRecoveryActions] = useState(false);

  const { loading: authLoading, submit } = useEmailPasswordAuth({
    next,
    onAuthSuccess,
  });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const trimmedEmail = email.trim();
  const emailLooksValid = isValidEmailForRecovery(email);
  const canUseRecoveryActions =
    emailLooksValid &&
    trimmedEmail.length >= 6 &&
    !isBlockedDomain(trimmedEmail) &&
    !authLoading &&
    !resetting &&
    !resendingConfirmation;
  const requirements = buildPasswordRequirements(password);

  useEffect(() => {
    setMode(null);
    setInfo(null);
    setPendingConfirmation(false);
    setShowRecoveryActions(false);
  }, [email]);

  useEffect(() => {
    if (!externalRecoveryMessage) return;
    setError(externalRecoveryMessage);
    setInfo(null);
    setPendingConfirmation(false);
    setShowRecoveryActions(true);
  }, [externalRecoveryMessage]);

  const determineMode = useCallback(async (): Promise<EmailAuthMode | null> => {
    if (!emailLooksValid) {
      setMode(null);
      return null;
    }
    if (trimmedEmail.length < 6 || isBlockedDomain(trimmedEmail)) {
      setError(
        "Usa un correo valido y evita dominios genericos (ej: test.com, example.com, mailinator.com).",
      );
      setMode(null);
      return null;
    }
    setCheckingEmail(true);
    try {
      const res = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
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
  }, [emailLooksValid, trimmedEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authLoading) return;
    if (!trimmedEmail) {
      setError("Por favor ingresa tu correo electronico.");
      return;
    }
    if (
      !emailLooksValid ||
      trimmedEmail.length < 6 ||
      isBlockedDomain(trimmedEmail)
    ) {
      setError(
        "Usa un correo valido y evita dominios genericos (ej: test.com, example.com, mailinator.com).",
      );
      return;
    }
    setError(null);
    setInfo(null);
    setPendingConfirmation(false);
    setShowRecoveryActions(false);

    let targetMode = mode;
    if (!targetMode) {
      targetMode = await determineMode();
    }
    if (!targetMode) {
      setError("Ingresa un correo valido para continuar.");
      return;
    }
    const normalizedName = normalizePersonName(fullName);
    if (targetMode === "signup" && !isValidPersonName(normalizedName)) {
      setError("Ingresa tu nombre completo (2 a 120 caracteres).");
      return;
    }
    if (!password.trim()) {
      setError("Ingresa tu contrasena para continuar.");
      return;
    }

    const result = await submit(
      targetMode,
      trimmedEmail,
      password,
      normalizedName,
    );
    if (!result.ok) {
      const presentation = getLoginErrorPresentation(result.error);
      setError(presentation.message);
      setShowRecoveryActions(presentation.showRecoveryActions);
      return;
    }
    if (result.pendingEmailConfirmation) {
      setPendingConfirmation(true);
      setInfo(null);
      setShowRecoveryActions(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!trimmedEmail) {
      setError(
        "Por favor escribe tu correo para enviarte el enlace de recuperacion.",
      );
      setSuccessMessage(null);
      return;
    }
    if (
      !isValidEmailForRecovery(trimmedEmail) ||
      trimmedEmail.length < 6 ||
      isBlockedDomain(trimmedEmail)
    ) {
      setError(
        "Usa un correo valido y evita dominios genericos (ej: test.com, example.com, mailinator.com).",
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
        body: JSON.stringify({ email: trimmedEmail }),
      });

      const data = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        message?: string;
      } | null;

      if (!res.ok || data?.success !== true) {
        console.error(
          "Error from send-password-reset endpoint:",
          res.status,
          data,
        );
        setError(
          data?.message ||
            data?.error ||
            "No pudimos enviar el correo de recuperacion. Intentalo de nuevo en unos minutos.",
        );
        setSuccessMessage(null);
        return;
      }

      setSuccessMessage(PASSWORD_RESET_SENT_MESSAGE);
      setError(null);
      setShowRecoveryActions(false);
    } catch (err) {
      console.error("Unexpected error sending reset password:", err);
      setError(
        "Ocurrio un error inesperado al enviar el correo. Intentalo de nuevo mas tarde.",
      );
      setSuccessMessage(null);
    } finally {
      setResetting(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!trimmedEmail) {
      setError("Escribe tu correo para reenviar la confirmacion.");
      setSuccessMessage(null);
      return;
    }
    if (
      !isValidEmailForRecovery(trimmedEmail) ||
      trimmedEmail.length < 6 ||
      isBlockedDomain(trimmedEmail)
    ) {
      setError(
        "Usa un correo valido y evita dominios genericos (ej: test.com, example.com, mailinator.com).",
      );
      setSuccessMessage(null);
      return;
    }

    setResendingConfirmation(true);
    setError(null);
    setInfo(null);
    setPendingConfirmation(false);
    try {
      const result = await requestResendConfirmation(trimmedEmail);
      if (!result.ok) {
        setError(result.message);
        setSuccessMessage(null);
        return;
      }
      setSuccessMessage(result.message);
      setShowRecoveryActions(false);
    } catch (err) {
      console.error("Unexpected error resending confirmation:", err);
      setError(
        "No pudimos reenviar el correo de confirmacion. Intenta de nuevo mas tarde.",
      );
      setSuccessMessage(null);
    } finally {
      setResendingConfirmation(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {showTitle ? (
        <div className="space-y-1.5">
          <h3 className="text-xl font-semibold text-slate-900">
            Accede con tu correo
          </h3>
          <p className="text-sm text-slate-500">
            Ingresa tu correo y contrasena para continuar. Si es tu primera vez,
            crea tu clave.
          </p>
        </div>
      ) : null}

      <div className="space-y-1">
        <label
          className="text-sm font-medium text-slate-700"
          htmlFor="full-name"
        >
          Nombre
        </label>
        <input
          id="full-name"
          data-testid="full-name"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Tu nombre"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm shadow-sm focus:border-[#0b835e] focus:outline-none"
          autoComplete="name"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700" htmlFor="email">
          Correo electronico
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
        <label
          className="text-sm font-medium text-slate-700"
          htmlFor="password"
        >
          Contrasena
        </label>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 shadow-sm focus-within:border-[#0b835e]">
          <input
            id="password"
            data-testid="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Ingresa tu contrasena"
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
            "Olvidaste tu contrasena?"
          )}
        </button>
      </div>

      {showRecoveryActions ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="mb-3 text-sm font-medium text-slate-700">
            Recupera el acceso con una de estas opciones:
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="sm:flex-1"
              onClick={() => {
                if (!resendingConfirmation) void handleResendConfirmation();
              }}
              disabled={!canUseRecoveryActions}
            >
              {resendingConfirmation ? (
                <>
                  <Spinner className="h-3.5 w-3.5" />
                  <span className="ml-2">Reenviando...</span>
                </>
              ) : (
                "Reenviar correo de confirmacion"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="sm:flex-1"
              onClick={() => {
                if (!resetting) void handleForgotPassword();
              }}
              disabled={!canUseRecoveryActions}
            >
              {resetting ? (
                <>
                  <Spinner className="h-3.5 w-3.5" />
                  <span className="ml-2">Enviando...</span>
                </>
              ) : (
                "Restablecer contrasena"
              )}
            </Button>
          </div>
          {!canUseRecoveryActions ? (
            <p className="mt-2 text-xs text-slate-500">
              Escribe un correo valido para habilitar estas acciones.
            </p>
          ) : null}
        </div>
      ) : null}

      {successMessage ? (
        <p className="text-sm text-green-700">{successMessage}</p>
      ) : null}

      {mode === "signup" ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="mb-2 text-sm font-semibold text-slate-700">
            Requisitos de contrasena
          </p>
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
                  {req.pass ? "OK" : "-"}
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
          "Iniciar sesion"
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
          {SIGNUP_CONFIRMATION_MESSAGE}
        </div>
      ) : null}
    </form>
  );
}
