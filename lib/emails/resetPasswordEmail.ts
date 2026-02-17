import {
  escapeHtml,
  renderHandiEmailLayoutHtml,
} from "@/lib/emails/handi-email-layout";

export function renderResetPasswordEmailHtml({
  resetUrl,
  email,
}: {
  resetUrl: string;
  email: string;
}) {
  const safeEmail = escapeHtml(email);
  const safeUrl = resetUrl || "";
  const body = `
    <p>
      Hola,
      <br /><br />
      Recibimos una solicitud para restablecer la contraseña de tu cuenta en Handi
      asociada al correo <strong>${safeEmail}</strong>.
    </p>
    <p>
      Haz clic en el siguiente botón para actualizar tu contraseña de forma segura:
    </p>
  `;

  return renderHandiEmailLayoutHtml({
    headerLabel: "Restablecer contraseña",
    title: "Restablecer tu contraseña",
    preheader: "Restablece tu contraseña de forma segura.",
    bodyHtml: body,
    cta: { label: "Restablecer contraseña", url: safeUrl },
    fallbackLinkUrl: safeUrl,
    securityNoteHtml:
      "<strong style=\"color:#082877;\">Nota de seguridad:</strong> Si tú no solicitaste este cambio, puedes ignorar este correo.",
  });
}
