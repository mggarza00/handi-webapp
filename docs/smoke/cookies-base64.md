# Smoke: cookies base64 con Supabase (SSR)

Objetivo: comprobar que no aparece el error "Failed to parse cookie string … base64-… is not valid JSON" y que los clientes SSR usan `cookieEncoding: 'base64'` de forma consistente.

Pasos manuales (dev)

1) Limpiar cookies del sitio
- En Chrome: Application → Storage → Clear site data (marca todo, especialmente Cookies y Local storage).

2) (Opcional) Ejecutar limpieza legacy
- Crea temporalmente una Server Action y llama a `await expireLegacyAuthCookie()` de `lib/supabase/expire-legacy-auth-cookie.ts`.
- Quita esa llamada después de una ejecución.

3) Reiniciar servidor
- `npm run dev` (o `npm run build && npm start`).

4) Login y verificación rápida
- Inicia sesión normalmente.
- Visita `/api/me/notifications/unread-count`.
- Debe responder `200` y JSON tipo `{ ok: true, count: N }`.
- Confirmar que NO aparece el error `Failed to parse cookie string` en consola/servidor.

5) Verificación automática de código
- `npm run verify:supabase` → verifica que no haya usos directos fuera de wrappers.
- `npm run check:supabase-clients` → idem (modo alternativo).

Notas
- Todos los SSR clients usan wrappers en `lib/supabase/*` con `cookieEncoding: 'base64'`.
- El middleware aplica la misma codificación y no hace parseos duplicados.

