import {
  escapeAttribute,
  escapeHtml,
  renderHandiEmailLayoutHtml,
} from "@/lib/emails/handi-email-layout";

type LayoutOpts = {
  headerLabel: string;
  title: string;
  preheader?: string;
  bodyHtml: string;
  cta?: { label: string; url: string } | null;
  fallbackLinkUrl?: string;
  securityNoteHtml?: string;
};

export function emailLayout({
  headerLabel,
  title,
  preheader,
  bodyHtml,
  cta,
  fallbackLinkUrl,
  securityNoteHtml,
}: LayoutOpts) {
  return renderHandiEmailLayoutHtml({
    headerLabel,
    title,
    preheader,
    bodyHtml,
    cta,
    fallbackLinkUrl,
    securityNoteHtml,
  });
}

export function applicationCreatedHtml(opts: {
  requestTitle?: string;
  linkUrl?: string;
}) {
  const title = "Nueva postulación";
  const safeTitle = escapeHtml(opts.requestTitle ?? "tu solicitud");
  const body = `
    <p>Recibiste una nueva postulación en: <strong>${safeTitle}</strong>.</p>
    <p>Ingresa a Handi para revisar el perfil y crear un acuerdo.</p>
  `;
  return emailLayout({
    headerLabel: "Notificación",
    title,
    preheader: "Tienes una nueva postulación",
    bodyHtml: body,
    cta: opts.linkUrl ? { label: "Abrir solicitud", url: opts.linkUrl } : null,
    fallbackLinkUrl: opts.linkUrl,
  });
}

export function applicationUpdatedHtml(opts: {
  requestId: string;
  status: string;
  linkUrl?: string;
}) {
  const title = `Tu postulación cambió a: ${opts.status}`;
  const safeStatus = escapeHtml(opts.status);
  const safeRequest = escapeHtml(opts.requestId);
  const body = `
    <p>La postulación de la solicitud <code>${safeRequest}</code> cambió a estado <strong>${safeStatus}</strong>.</p>
  `;
  return emailLayout({
    headerLabel: "Actualización",
    title,
    preheader: title,
    bodyHtml: body,
    cta: opts.linkUrl ? { label: "Abrir solicitud", url: opts.linkUrl } : null,
    fallbackLinkUrl: opts.linkUrl,
  });
}

export function agreementCreatedHtml(opts: {
  requestTitle?: string;
  agreementIdShort: string;
  linkUrl?: string;
}) {
  const title = `Nuevo acuerdo #${opts.agreementIdShort}`;
  const safeReq = escapeHtml(opts.requestTitle ?? "");
  const safeId = escapeHtml(opts.agreementIdShort);
  const body = `
    <p>Se creó un acuerdo para la solicitud <strong>${safeReq}</strong>.</p>
    <p>Revisa los detalles y continúa el flujo de pago o aceptación.</p>
  `;
  return emailLayout({
    headerLabel: "Notificación",
    title,
    preheader: `Nuevo acuerdo #${safeId}`,
    bodyHtml: body,
    cta: opts.linkUrl ? { label: "Ver acuerdo", url: opts.linkUrl } : null,
    fallbackLinkUrl: opts.linkUrl,
  });
}

export function agreementUpdatedHtml(opts: {
  requestTitle?: string;
  agreementIdShort: string;
  status: string;
  linkUrl?: string;
}) {
  const title = `Acuerdo actualizado: ${opts.status}`;
  const safeReq = escapeHtml(opts.requestTitle ?? "");
  const safeId = escapeHtml(opts.agreementIdShort);
  const safeStatus = escapeHtml(opts.status);
  const body = `
    <p>El acuerdo <strong>#${safeId}</strong> de la solicitud <strong>${safeReq}</strong> cambió a estado <strong>${safeStatus}</strong>.</p>
  `;
  return emailLayout({
    headerLabel: "Actualización",
    title,
    preheader: title,
    bodyHtml: body,
    cta: opts.linkUrl ? { label: "Abrir solicitud", url: opts.linkUrl } : null,
    fallbackLinkUrl: opts.linkUrl,
  });
}

export function messageReceivedHtml(opts: {
  requestTitle?: string;
  senderName?: string | null;
  preview: string;
  linkUrl?: string;
}) {
  const title = "Nuevo mensaje";
  const safeSender = escapeHtml(opts.senderName ?? "usuario");
  const safeReq = escapeHtml(opts.requestTitle ?? "");
  const safePreview = escapeHtml(opts.preview);
  const body = `
    <p>Recibiste un nuevo mensaje de <strong>${safeSender}</strong> para: <strong>${safeReq}</strong>.</p>
    <blockquote style="margin:0 0 16px;padding:12px 14px;border-left:4px solid #082877;background:#f1f5ff;color:#1f2a44;border-radius:10px;line-height:1.6;">
      ${safePreview}
    </blockquote>
  `;
  return emailLayout({
    headerLabel: "Nuevo mensaje",
    title,
    preheader: "Tienes un nuevo mensaje",
    bodyHtml: body,
    cta: opts.linkUrl ? { label: "Abrir conversación", url: opts.linkUrl } : null,
    fallbackLinkUrl: opts.linkUrl,
  });
}

export function firstProfessionalAvailableHtml(opts: {
  requestTitle?: string | null;
  professionalName?: string | null;
  linkUrl?: string;
}) {
  const title = "Encontramos un profesional para tu solicitud";
  const safeReq = escapeHtml(opts.requestTitle ?? "tu solicitud");
  const safePro = escapeHtml(opts.professionalName ?? "Un profesional");
  const body = `
    <p>${opts.professionalName ? `<strong>${safePro}</strong>` : "Un profesional"} está listo para apoyarte en <strong>${safeReq}</strong>.</p>
    <p>Entra a Handi para revisar su perfil y continuar con el proceso.</p>
  `;
  return emailLayout({
    headerLabel: "Notificación",
    title,
    preheader: "Ya tenemos un profesional disponible para tu solicitud",
    bodyHtml: body,
    cta: opts.linkUrl ? { label: "Ver solicitud", url: opts.linkUrl } : null,
    fallbackLinkUrl: opts.linkUrl,
  });
}

export function proApplicationAcceptedHtml(opts: { linkUrl?: string; imageUrl?: string }) {
  const title = "¡Has sido aceptado como profesional!";
  const safeImage = opts.imageUrl ? escapeAttribute(opts.imageUrl) : "";
  const body = `
    ${opts.imageUrl ? `<p style="margin:12px 0 16px;"><img src="${safeImage}" alt="Solicitud aceptada" style="max-width:100%; border-radius:12px; display:block;" /></p>` : ""}
    <p>Tu solicitud para unirte como profesional en Handi fue <strong>aceptada</strong>.</p>
    <p>Ya puedes completar tu perfil y comenzar a recibir oportunidades.</p>
  `;
  return emailLayout({
    headerLabel: "Notificación",
    title,
    preheader: title,
    bodyHtml: body,
    cta: opts.linkUrl ? { label: "Ir a mi perfil", url: opts.linkUrl } : null,
    fallbackLinkUrl: opts.linkUrl,
  });
}

export function proApplicationRejectedHtml(opts: { linkUrl?: string }) {
  const title = "Resultado de tu solicitud";
  const body = `
    <p>Tu solicitud para unirte como profesional fue <strong>rechazada</strong> en esta ocasión.</p>
    <p>Puedes actualizar tu información y volver a intentarlo más adelante.</p>
  `;
  return emailLayout({
    headerLabel: "Notificación",
    title,
    preheader: title,
    bodyHtml: body,
    cta: opts.linkUrl ? { label: "Revisar mi perfil", url: opts.linkUrl } : null,
    fallbackLinkUrl: opts.linkUrl,
  });
}
