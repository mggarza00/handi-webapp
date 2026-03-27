import {
  escapeAttribute,
  escapeHtml,
  renderHandiEmailLayoutHtml,
} from "@/lib/emails/handi-email-layout";

type ServiceCompletedThankYouEmailArgs = {
  name?: string | null;
  requestTitle?: string | null;
  professionalName?: string | null;
  serviceDateLabel?: string | null;
  photoUrls?: string[] | null;
  supportEmail?: string | null;
};

function normalizeText(value?: string | null, fallback?: string): string {
  const normalized = (value || "").replace(/\s+/g, " ").trim();
  if (normalized) return normalized;
  return fallback || "";
}

function compactPhotoUrls(urls?: string[] | null): string[] {
  if (!Array.isArray(urls)) return [];
  const seen = new Set<string>();
  const next: string[] = [];
  for (const raw of urls) {
    const value = (raw || "").trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    next.push(value);
    if (next.length >= 4) break;
  }
  return next;
}

export function renderServiceCompletedThankYouEmailHtml(
  args: ServiceCompletedThankYouEmailArgs,
): string {
  const name = normalizeText(args.name, "Cliente");
  const requestTitle = normalizeText(args.requestTitle, "tu servicio");
  const professionalName = normalizeText(
    args.professionalName,
    "Profesional Handi",
  );
  const serviceDateLabel = normalizeText(args.serviceDateLabel);
  const supportEmail = normalizeText(
    args.supportEmail,
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "soporte@handi.mx",
  );
  const photoUrls = compactPhotoUrls(args.photoUrls);

  const summaryCards = [
    { label: "Servicio", value: requestTitle },
    { label: "Profesional", value: professionalName },
    {
      label: "Fecha",
      value: serviceDateLabel || "Coordinada contigo",
    },
  ]
    .map(
      (item) => `
        <td style="padding:0 6px 12px;vertical-align:top;">
          <div style="min-height:92px;border:1px solid #e2e8f0;border-radius:16px;background:#fff7ed;padding:14px 14px 12px;">
            <div style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.3px;text-transform:uppercase;color:#7c8aa5;">
              ${escapeHtml(item.label)}
            </div>
            <div style="font-size:15px;line-height:1.5;color:#082877;font-weight:700;">
              ${escapeHtml(item.value)}
            </div>
          </div>
        </td>
      `,
    )
    .join("");

  const photosSection =
    photoUrls.length > 0
      ? `
        <div style="margin:0 0 24px;">
          <p style="margin:0 0 10px;font-size:16px;font-weight:700;color:#082877;">
            Referencias del trabajo realizado
          </p>
          <p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#334155;">
            Te compartimos una vista breve del trabajo para que tengas el cierre del servicio a la mano.
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              ${photoUrls
                .map(
                  (url) => `
                    <td style="padding:0 6px 12px;vertical-align:top;width:${Math.floor(100 / photoUrls.length)}%;">
                      <div style="border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;background:#f8fafc;">
                        <img
                          src="${escapeAttribute(url)}"
                          alt="Foto del trabajo realizado"
                          style="display:block;width:100%;height:118px;object-fit:cover;background:#e2e8f0;"
                        />
                      </div>
                    </td>
                  `,
                )
                .join("")}
            </tr>
          </table>
        </div>
      `
      : "";

  const body = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.8;color:#001447;">
      Hola <strong>${escapeHtml(name)}</strong>,
    </p>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.8;color:#001447;">
      Gracias por confiar en Handi. Esperamos de verdad que hayas tenido una gran experiencia y que el resultado te deje con ganas de volver a contar con nosotros cuando lo necesites.
    </p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.8;color:#001447;">
      Tu servicio <strong>${escapeHtml(requestTitle)}</strong> fue realizado por <strong>${escapeHtml(professionalName)}</strong>. Te dejamos un resumen breve del trabajo para cerrar esta experiencia contigo con el mismo cuidado con el que empezo.
    </p>
    <div style="margin:0 0 22px;padding:18px;border-radius:20px;background:linear-gradient(180deg,#fffdfa 0%,#fff7ed 100%);border:1px solid #fde7c7;">
      <p style="margin:0 0 14px;font-size:16px;font-weight:700;color:#082877;">
        Resumen del servicio
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          ${summaryCards}
        </tr>
      </table>
    </div>
    ${photosSection}
    <div style="margin:0;padding:16px 18px;border:1px solid #e2e8f0;border-radius:16px;background:#f8fafc;">
      <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#082877;">
        Estamos para ayudarte
      </p>
      <p style="margin:0;font-size:14px;line-height:1.7;color:#334155;">
        Si necesitas cualquier apoyo adicional o quieres contarnos como te fue, escribenos a
        <a href="mailto:${escapeAttribute(supportEmail)}" style="color:#082877;text-decoration:none;font-weight:700;">${escapeHtml(supportEmail)}</a>.
      </p>
    </div>
  `;

  return renderHandiEmailLayoutHtml({
    headerLabel: "Gracias por usar Handi",
    title: "Gracias por confiar en Handi",
    preheader:
      "Esperamos que hayas tenido una gran experiencia con tu servicio.",
    bodyHtml: body,
    supportEmail,
  });
}

export function renderServiceCompletedThankYouEmailText(
  args: ServiceCompletedThankYouEmailArgs,
): string {
  const name = normalizeText(args.name, "Cliente");
  const requestTitle = normalizeText(args.requestTitle, "tu servicio");
  const professionalName = normalizeText(
    args.professionalName,
    "Profesional Handi",
  );
  const serviceDateLabel = normalizeText(args.serviceDateLabel);
  const supportEmail = normalizeText(
    args.supportEmail,
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "soporte@handi.mx",
  );
  const photoUrls = compactPhotoUrls(args.photoUrls);

  const lines = [
    `Hola ${name},`,
    "Gracias por confiar en Handi.",
    "Esperamos que hayas tenido una gran experiencia con el servicio realizado.",
    `Servicio: ${requestTitle}`,
    `Profesional: ${professionalName}`,
    serviceDateLabel
      ? `Fecha: ${serviceDateLabel}`
      : "Fecha: Coordinada contigo",
    photoUrls.length > 0
      ? `Fotos de referencia registradas: ${photoUrls.length}`
      : null,
    `Si necesitas apoyo adicional, estamos para ayudarte en ${supportEmail}.`,
  ].filter(Boolean) as string[];

  return lines.join("\n\n");
}
