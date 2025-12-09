type LayoutOpts = {
  title: string;
  preheader?: string;
  childrenHtml: string;
};

export function emailLayout({ title, preheader, childrenHtml }: LayoutOpts) {
  const safePre = preheader ? preheader.replace(/</g, "&lt;") : "";
  const rawBase =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://handi.mx');
  const siteBase = rawBase.replace(/\/$/, "");
  const logoUrl = `${siteBase}/images/LOGO_HANDI_DB.png`;
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body { background:#f6f7fb; color:#0f172a; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji", "Segoe UI Emoji"; margin:0; padding:0; }
      .preheader { display:none; visibility:hidden; opacity:0; height:0; width:0; overflow:hidden; }
      .container { max-width: 600px; margin: 0 auto; padding: 24px 16px; }
      .card { background:#ffffff; border:1px solid #e5e7eb; border-radius:12px; padding: 24px; }
      .brand { font-weight: 700; font-size: 18px; color:#0f172a; text-decoration:none; }
      .muted { color:#64748b; font-size: 12px; }
      h1 { font-size: 18px; margin: 0 0 12px; }
      p { line-height: 1.6; margin: 0 0 12px; }
      .footer { margin-top: 16px; text-align:center; }
      .btn { display:inline-block; background:#0f172a; color:#fff; text-decoration:none; padding:10px 16px; border-radius:8px; font-size:14px; }
    </style>
  </head>
  <body>
    <span class="preheader">${safePre}</span>
    <div class="container">
      <div style="margin: 0 0 12px; text-align:center;">
        <a href="${siteBase}"><img src="${logoUrl}" alt="Handi" height="80" style="height:80px" /></a>
      </div>
      <div class="card">
        ${childrenHtml}
      </div>
      <div class="footer">
        <p class="muted">Este es un mensaje automático. No respondas a este correo.</p>
      </div>
    </div>
  </body>
 </html>`;
}

export function applicationCreatedHtml(opts: {
  requestTitle?: string;
  linkUrl?: string;
}) {
  const title = "Nueva postulación";
  const body = `
    <h1>${title}</h1>
    <p>Recibiste una nueva postulación en: <strong>${opts.requestTitle ?? "tu solicitud"}</strong>.</p>
    <p>Ingresa a Handi para revisar el perfil y crear un acuerdo.</p>
    ${opts.linkUrl ? `<p><a class="btn" href="${opts.linkUrl}">Abrir solicitud</a></p>` : ""}
  `;
  return emailLayout({
    title,
    preheader: "Tienes una nueva postulación",
    childrenHtml: body,
  });
}

export function applicationUpdatedHtml(opts: {
  requestId: string;
  status: string;
  linkUrl?: string;
}) {
  const title = `Tu postulación cambió a: ${opts.status}`;
  const body = `
    <h1>${title}</h1>
    <p>La postulación de la solicitud <code>${opts.requestId}</code> cambió a estado <strong>${opts.status}</strong>.</p>
    ${opts.linkUrl ? `<p><a class="btn" href="${opts.linkUrl}">Abrir solicitud</a></p>` : ""}
  `;
  return emailLayout({ title, preheader: title, childrenHtml: body });
}

export function agreementCreatedHtml(opts: {
  requestTitle?: string;
  agreementIdShort: string;
  linkUrl?: string;
}) {
  const title = `Nuevo acuerdo #${opts.agreementIdShort}`;
  const body = `
    <h1>${title}</h1>
    <p>Se creó un acuerdo para la solicitud <strong>${opts.requestTitle ?? ""}</strong>.</p>
    <p>Revisa los detalles y continúa el flujo de pago o aceptación.</p>
    ${opts.linkUrl ? `<p><a class="btn" href="${opts.linkUrl}">Ver acuerdo</a></p>` : ""}
  `;
  return emailLayout({ title, preheader: title, childrenHtml: body });
}

export function agreementUpdatedHtml(opts: {
  requestTitle?: string;
  agreementIdShort: string;
  status: string;
  linkUrl?: string;
}) {
  const title = `Acuerdo actualizado: ${opts.status}`;
  const body = `
    <h1>${title}</h1>
    <p>El acuerdo <strong>#${opts.agreementIdShort}</strong> de la solicitud <strong>${opts.requestTitle ?? ""}</strong> cambió a estado <strong>${opts.status}</strong>.</p>
    ${opts.linkUrl ? `<p><a class="btn" href="${opts.linkUrl}">Abrir solicitud</a></p>` : ""}
  `;
  return emailLayout({ title, preheader: title, childrenHtml: body });
}

export function messageReceivedHtml(opts: {
  requestTitle?: string;
  senderName?: string | null;
  preview: string;
  linkUrl?: string;
}) {
  const title = "Nuevo mensaje";
  const body = `
    <h1>${title}</h1>
    <p>Recibiste un nuevo mensaje de <strong>${opts.senderName ?? "usuario"}</strong> para: <strong>${opts.requestTitle ?? ""}</strong>.</p>
    <blockquote>${opts.preview}</blockquote>
    ${opts.linkUrl ? `<p><a class="btn" href="${opts.linkUrl}" style="background:#0B3949;color:#ffffff">Abrir conversación</a></p>` : ""}
  `;
  return emailLayout({
    title,
    preheader: "Tienes un nuevo mensaje",
    childrenHtml: body,
  });
}

export function firstProfessionalAvailableHtml(opts: {
  requestTitle?: string | null;
  professionalName?: string | null;
  linkUrl?: string;
}) {
  const title = "Encontramos un profesional para tu solicitud";
  const body = `
    <h1>${title}</h1>
    <p>${opts.professionalName ? `<strong>${opts.professionalName}</strong>` : "Un profesional"} está listo para apoyarte en <strong>${opts.requestTitle ?? "tu solicitud"}</strong>.</p>
    <p>Entra a Handi para revisar su perfil y continuar con el proceso.</p>
    ${opts.linkUrl ? `<p><a class="btn" href="${opts.linkUrl}">Ver solicitud</a></p>` : ""}
  `;
  return emailLayout({
    title,
    preheader: "Ya tenemos un profesional disponible para tu solicitud",
    childrenHtml: body,
  });
}

export function proApplicationAcceptedHtml(opts: { linkUrl?: string; imageUrl?: string }) {
  const title = "¡Has sido aceptado como profesional!";
  const body = `
    <h1>${title}</h1>
    ${opts.imageUrl ? `<p style="margin:12px 0 16px;"><img src="${opts.imageUrl}" alt="Solicitud aceptada" style="max-width:100%; border-radius:12px; display:block;" /></p>` : ""}
    <p>Tu solicitud para unirte como profesional en Handi fue <strong>aceptada</strong>.</p>
    <p>Ya puedes completar tu perfil y comenzar a recibir oportunidades.</p>
    ${opts.linkUrl ? `<p><a class="btn" href="${opts.linkUrl}">Ir a mi perfil</a></p>` : ""}
  `;
  return emailLayout({ title, preheader: title, childrenHtml: body });
}

export function proApplicationRejectedHtml(opts: { linkUrl?: string }) {
  const title = "Resultado de tu solicitud";
  const body = `
    <h1>${title}</h1>
    <p>Tu solicitud para unirte como profesional fue <strong>rechazada</strong> en esta ocasión.</p>
    <p>Puedes actualizar tu información y volver a intentarlo más adelante.</p>
    ${opts.linkUrl ? `<p><a class="btn" href="${opts.linkUrl}">Revisar mi perfil</a></p>` : ""}
  `;
  return emailLayout({ title, preheader: title, childrenHtml: body });
}
