E2E Handi Flow

Cómo correr
- npm run e2e (usa playwright.local.config.ts y ejecuta los specs en tests/e2e)
- npm run e2e:ui para modo UI

Pago: Stripe vs Stub
- Por defecto el test usa el stub: POST /api/test/pay { requestId } con header x-e2e: 1.
- Alternativa A (comentada en el test): integrar UI de Stripe test (4242 4242 4242 4242) en sesión interactiva.

Chats
- Nuevos: tests/e2e/chat-request.spec.ts y tests/e2e/chat-messages.spec.ts
- Realtime: valida ida/vuelta cliente↔pro y consistencia entre /requests/[id] y /messages.
- Requisitos de testids: si no se encuentran, los helpers fallan con mensaje claro.

Semilla de usuarios E2E
- Endpoint: GET /api/test-seed?action=seed-e2e-users
- Usuarios:
  - Cliente: cliente.e2e@homaid.mx / E2e!Pass123
  - Profesional: pro.e2e@homaid.mx / E2e!Pass123

Requisitos
- NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY configurados para endpoints admin.
- E2E_BASE_URL opcional (por defecto http://localhost:3000).
