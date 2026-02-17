type HandiEmailLayoutOpts = {
  headerLabel: string;
  title: string;
  preheader?: string;
  bodyHtml: string;
  cta?: { label: string; url: string } | null;
  fallbackLinkUrl?: string;
  securityNoteHtml?: string;
  supportEmail?: string;
  year?: number;
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function getSiteBase(): string {
  const rawBase =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "https://handi.mx");
  return rawBase.replace(/\/$/, "");
}

export function renderHandiEmailLayoutHtml(
  opts: HandiEmailLayoutOpts,
): string {
  const preheader = (opts.preheader || "").trim();
  const supportEmail = (
    opts.supportEmail ||
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL ||
    "soporte@handi.mx"
  ).trim();
  const year = typeof opts.year === "number" ? opts.year : new Date().getFullYear();
  const siteBase = getSiteBase();
  const logoUrl = `${siteBase}/images/LOGO_HEADER_B.png`;
  const cta = opts.cta?.url ? opts.cta : null;
  const fallbackUrl = (opts.fallbackLinkUrl || cta?.url || "").trim();

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${escapeHtml(opts.title)}</title>
    <style>
      @media only screen and (max-width: 640px) {
        .container { width: 100% !important; }
        .content { padding: 24px 20px !important; }
        .cta { width: 100% !important; text-align: center !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#F9E7D2;font-family:'Inter','Segoe UI',system-ui,sans-serif;color:#001447;font-weight:400;">
    <div style="display:none;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F9E7D2;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" class="container" width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 18px 48px rgba(8, 40, 119, 0.12);">
            <tr>
              <td style="background:linear-gradient(135deg,#082877,#5A9CF4);padding:18px 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <img src="${escapeAttribute(logoUrl)}" alt="Handi" height="120" style="display:block;height:120px;" />
                    </td>
                    <td style="text-align:right;font-size:12px;font-weight:700;letter-spacing:0.4px;color:#e6edff;vertical-align:middle;">
                      ${escapeHtml(opts.headerLabel)}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="content" style="padding:30px 32px 18px;">
                <p style="margin:0 0 12px;font-size:20px;font-weight:700;color:#082877;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;">
                  ${escapeHtml(opts.title)}
                </p>
                ${opts.bodyHtml}
                ${cta ? `
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0 22px;width:100%;">
                  <tr>
                    <td class="cta" style="text-align:center;">
                      <a href="${escapeAttribute(cta.url)}" style="display:inline-block;background:#082877;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:12px;font-weight:700;font-size:15px;letter-spacing:0.2px;box-shadow:0 10px 30px rgba(8,40,119,0.18);" target="_blank" rel="noopener noreferrer">
                        ${escapeHtml(cta.label)}
                      </a>
                    </td>
                  </tr>
                </table>
                ` : ""}
                ${cta && fallbackUrl ? `
                <p style="margin:0 0 8px;font-size:13px;color:#334155;">Si el botÃ³n no funciona, copia y pega este enlace:</p>
                <p style="margin:0 0 18px;font-size:12px;line-height:1.6;color:#001447;word-break:break-all;">${escapeHtml(fallbackUrl)}</p>
                ` : ""}
                ${opts.securityNoteHtml ? `
                <div style="margin:0 0 20px;padding:14px 16px;border:1px solid #e5e7eb;border-radius:12px;background:#f8fafc;color:#334155;font-size:12px;line-height:1.6;">
                  ${opts.securityNoteHtml}
                </div>
                ` : ""}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px 26px;border-top:1px solid #e5e7eb;background:#f9fafb;font-size:12px;line-height:1.6;color:#667085;">
                <div style="font-weight:700;color:#082877;margin-bottom:6px;">Handi</div>
                <div style="margin-bottom:6px;">Soporte: <a href="mailto:${escapeAttribute(supportEmail)}" style="color:#082877;text-decoration:none;">${escapeHtml(supportEmail)}</a></div>
                <div style="margin-bottom:6px;">Â© ${year} Handi. Todos los derechos reservados.</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
