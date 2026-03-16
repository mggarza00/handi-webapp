export type AppErrorCode =
  | "AUTH_SESSION_INVALID"
  | "AUTH_REQUIRED"
  | "INVALID_CREDENTIALS"
  | "PROFILE_INCONSISTENT"
  | "NETWORK_ERROR"
  | "PERMISSION_DENIED"
  | "RATE_LIMITED"
  | "PAYMENT_FAILED"
  | "ONBOARDING_FAILED"
  | "ROLE_SWITCH_FAILED"
  | "REQUEST_FAILED"
  | "OFFER_FAILED"
  | "UNEXPECTED_ERROR";

export type NormalizedAppError = {
  code: AppErrorCode;
  userMessage: string;
  technicalMessage: string;
  status?: number;
  retryable: boolean;
};

type NormalizeErrorOptions = {
  status?: number;
  source?: string;
  code?: string | null;
  detail?: string | null;
};

function toText(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.message || value.name || "Error";
  if (typeof value === "object") {
    const rec = value as Record<string, unknown>;
    const msg = [rec.message, rec.error, rec.detail]
      .map((v) => (typeof v === "string" ? v : ""))
      .find(Boolean);
    if (msg) return msg;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function pickCode(input: string, status?: number): AppErrorCode {
  const text = input.toLowerCase();

  if (
    status === 401 ||
    /auth session missing|session.*(invalid|expired)|invalid.*session|jwt|token.*(expired|invalid)/i.test(
      text,
    )
  ) {
    return "AUTH_SESSION_INVALID";
  }
  if (
    /not authenticated|authentication required|auth required|unauthorized/i.test(
      text,
    )
  ) {
    return "AUTH_REQUIRED";
  }
  if (
    /invalid login credentials|invalid credentials|invalid_grant|wrong password/i.test(
      text,
    )
  ) {
    return "INVALID_CREDENTIALS";
  }
  if (
    /cannot coerce the result to a single json object|json object requested, multiple \(or no\) rows returned|profile.*(missing|not found|inconsistent)/i.test(
      text,
    )
  ) {
    return "PROFILE_INCONSISTENT";
  }
  if (
    /networkerror|failed to fetch|network request failed|timeout|aborted|econnreset|enotfound/i.test(
      text,
    )
  ) {
    return "NETWORK_ERROR";
  }
  if (
    status === 403 ||
    /permission|forbidden|not authorized|rls|insufficient.*privilege/i.test(
      text,
    )
  ) {
    return "PERMISSION_DENIED";
  }
  if (status === 429 || /rate.?limit|too many requests/i.test(text)) {
    return "RATE_LIMITED";
  }
  if (
    /stripe|payment|checkout|card_declined|insufficient_funds|payment_intent/i.test(
      text,
    )
  ) {
    return "PAYMENT_FAILED";
  }
  return "UNEXPECTED_ERROR";
}

export function getUserErrorMessage(code: AppErrorCode): string {
  switch (code) {
    case "AUTH_SESSION_INVALID":
      return "Tu sesión ya no es válida. Vuelve a iniciar sesión.";
    case "AUTH_REQUIRED":
      return "Necesitas iniciar sesión para continuar.";
    case "INVALID_CREDENTIALS":
      return "La contraseña es incorrecta o tu cuenta aún no está confirmada.";
    case "PROFILE_INCONSISTENT":
      return "No pudimos cargar tu cuenta. Cierra sesión y vuelve a entrar.";
    case "NETWORK_ERROR":
      return "Parece que hay un problema de conexión. Intenta de nuevo.";
    case "PERMISSION_DENIED":
      return "No tienes permisos para realizar esta acción.";
    case "RATE_LIMITED":
      return "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
    case "PAYMENT_FAILED":
      return "No pudimos procesar el pago. Intenta de nuevo.";
    case "ONBOARDING_FAILED":
      return "No pudimos completar tu onboarding. Intenta de nuevo.";
    case "ROLE_SWITCH_FAILED":
      return "No pudimos cambiar tu tipo de usuario. Intenta de nuevo.";
    case "REQUEST_FAILED":
      return "No pudimos completar esta acción. Intenta de nuevo.";
    case "OFFER_FAILED":
      return "No pudimos completar la operación de la oferta. Intenta de nuevo.";
    case "UNEXPECTED_ERROR":
    default:
      return "Ocurrió un problema inesperado. Ya lo estamos revisando.";
  }
}

export function normalizeAppError(
  error: unknown,
  options: NormalizeErrorOptions = {},
): NormalizedAppError {
  const technicalMessage = [
    toText(error),
    options.code || "",
    options.detail || "",
    options.source || "",
  ]
    .filter(Boolean)
    .join(" | ");
  const code = pickCode(technicalMessage, options.status);
  return {
    code,
    userMessage: getUserErrorMessage(code),
    technicalMessage: technicalMessage || "Unknown error",
    status: options.status,
    retryable:
      code === "NETWORK_ERROR" ||
      code === "RATE_LIMITED" ||
      code === "REQUEST_FAILED" ||
      code === "OFFER_FAILED" ||
      code === "UNEXPECTED_ERROR",
  };
}
