export const SIGNUP_CONFIRMATION_MESSAGE =
  "Te enviamos un enlace para confirmar tu cuenta. Revisa bandeja de entrada, spam y promociones.";

export const PASSWORD_RESET_SENT_MESSAGE =
  "Te enviamos un correo con un enlace para restablecer tu contrasena. Revisa bandeja de entrada, spam y promociones.";

export const INVALID_LOGIN_HELP_MESSAGE =
  "La contrasena es incorrecta o tu cuenta aun no esta confirmada.";

export const EXPIRED_AUTH_LINK_MESSAGE = "Este enlace expiro o ya fue usado.";

type CallbackErrorLike = {
  status?: string | null;
  code?: string | null;
  error?: string | null;
  authLink?: string | null;
};

export function isInvalidLoginCredentialsError(rawError: string): boolean {
  const normalized = rawError.toLowerCase();
  return (
    normalized.includes("invalid login credentials") ||
    normalized.includes("invalid_credentials") ||
    normalized.includes("email not confirmed") ||
    normalized.includes("invalid grant")
  );
}

export function getLoginErrorPresentation(rawError: string): {
  message: string;
  showRecoveryActions: boolean;
} {
  if (isInvalidLoginCredentialsError(rawError)) {
    return {
      message: INVALID_LOGIN_HELP_MESSAGE,
      showRecoveryActions: true,
    };
  }
  return {
    message: rawError || "No pudimos iniciar sesion. Intenta de nuevo.",
    showRecoveryActions: false,
  };
}

export function isExpiredOrUsedAuthLink(params: CallbackErrorLike): boolean {
  const status = (params.status || "").trim();
  const code = (params.code || "").toLowerCase();
  const error = (params.error || "").toLowerCase();
  const authLink = (params.authLink || "").toLowerCase();

  if (authLink === "expired_or_used") return true;
  if (status === "400" || status === "401" || status === "410") {
    if (
      error.includes("otp") ||
      error.includes("token") ||
      error.includes("expired")
    ) {
      return true;
    }
  }

  return (
    code.includes("otp_expired") ||
    code.includes("otp_disabled") ||
    code.includes("invalid_token") ||
    code.includes("expired") ||
    error.includes("expired") ||
    error.includes("already been used") ||
    error.includes("token has expired") ||
    error.includes("invalid or expired") ||
    error.includes("missing_oauth_params")
  );
}

export function isValidEmailForRecovery(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
