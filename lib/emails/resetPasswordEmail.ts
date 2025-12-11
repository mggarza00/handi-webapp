export function renderResetPasswordEmailHtml({
  resetUrl,
  email,
}: {
  resetUrl: string;
  email: string;
}) {
  return `
  <!DOCTYPE html>
  <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Restablecer tu contraseña · Handi</title>
      <style>
        body {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          background-color: #f4f5fb;
          padding: 24px;
          color: #111827;
        }
        .card {
          max-width: 520px;
          margin: 0 auto;
          background: #ffffff;
          border-radius: 16px;
          padding: 24px 24px 32px;
          box-shadow: 0 20px 40px rgba(15, 23, 42, 0.12);
        }
        .logo {
          font-size: 20px;
          font-weight: 700;
          color: #16a34a;
          letter-spacing: 0.2px;
          margin-bottom: 12px;
        }
        .title {
          font-size: 22px;
          font-weight: 600;
          margin-bottom: 8px;
        }
        .text {
          font-size: 14px;
          line-height: 1.6;
          margin-bottom: 16px;
        }
        .button {
          display: inline-block;
          padding: 12px 24px;
          background-color: #16a34a;
          color: #ffffff;
          text-decoration: none;
          border-radius: 999px;
          font-weight: 600;
          font-size: 14px;
          margin: 16px 0;
        }
        .link {
          font-size: 12px;
          word-break: break-all;
          color: #4b5563;
        }
        .footer {
          font-size: 11px;
          color: #9ca3af;
          margin-top: 24px;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">Handi</div>
        <h1 class="title">Restablecer tu contraseña</h1>
        <p class="text">
          Hola,
          <br /><br />
          Recibimos una solicitud para restablecer la contraseña de tu cuenta en Handi
          asociada al correo <strong>${email}</strong>.
        </p>
        <p class="text">
          Haz clic en el siguiente botón para actualizar tu contraseña de forma segura:
        </p>
        <p>
          <a class="button" href="${resetUrl}" target="_blank" rel="noopener noreferrer">
            Restablecer contraseña
          </a>
        </p>
        <p class="text">
          Si el botón no funciona, copia y pega este enlace en tu navegador:
        </p>
        <p class="link">${resetUrl}</p>
        <p class="footer">
          Si tú no solicitaste este cambio, puedes ignorar este correo.
          <br />
           ${new Date().getFullYear()} Handi. Todos los derechos reservados.
        </p>
      </div>
    </body>
  </html>
  `;
}
