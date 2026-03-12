export const RESEND_CONFIRMATION_ENDPOINT = "/api/auth/resend-confirmation";

type ResendConfirmationResponse = {
  success?: boolean;
  message?: string;
  error?: string;
};

export async function requestResendConfirmation(
  email: string,
  fetcher: typeof fetch = fetch,
): Promise<{ ok: boolean; message: string }> {
  const response = await fetcher(RESEND_CONFIRMATION_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  const data = (await response
    .json()
    .catch(() => null)) as ResendConfirmationResponse | null;

  if (!response.ok || data?.success !== true) {
    return {
      ok: false,
      message:
        data?.message ||
        data?.error ||
        "No pudimos reenviar el correo de confirmacion. Intenta de nuevo mas tarde.",
    };
  }

  return {
    ok: true,
    message:
      data?.message ||
      "Si existe una cuenta pendiente para este correo, te enviamos un nuevo enlace. Revisa bandeja de entrada, spam y promociones.",
  };
}
