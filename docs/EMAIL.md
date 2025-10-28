# Email (Resend)

Este proyecto usa Resend como proveedor de correo en producción.

- Variables requeridas (en Vercel/producción y staging):
  - `RESEND_API_KEY`
  - `RESEND_FROM` (ej. `Equipo Handi <notificaciones@mg.handi.mx>`) — debe ser del dominio verificado (mg.handi.mx)
  - `RESEND_REPLY_TO` (ej. `soporte@handi.mx`)

- Cliente central: `lib/email/resend.ts` expone `resend`, `RESEND_FROM`, `RESEND_REPLY_TO` y helpers.
- Todas las rutas deben responder JSON con `Content-Type: application/json; charset=utf-8`.
- Los payloads de envío garantizan `html` o `text` (si faltan ambos, se envía `text: ''`).
- Manejo explícito de sandbox/validation_error: 400 con `code: RESEND_SANDBOX_ERROR` y un `hint`.

## Probar envío en producción/staging

Ejemplo de cURL con UTF-8:

```
curl -X POST https://handi.mx/api/email/test \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{
    "to": "destinatario@dominio.com",
    "subject": "Prueba",
    "_html": "<strong>Hola</strong> desde Handi"
  }'
```

- Éxito: `{ ok: true, id }`
- Sandbox/validación: `400 { ok: false, code: "RESEND_SANDBOX_ERROR", hint, error }`
- Otros errores: `400 { ok: false, error }`

