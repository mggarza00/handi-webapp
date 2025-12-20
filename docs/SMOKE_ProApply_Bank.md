# Smoke: /pro-apply — Cuentas bancarias

Este documento guía un smoke test manual para validar la nueva sección "Cuentas bancarias" en `/pro-apply` y su sincronización con `/settings`.

## Pre requisitos

- App en dev (`npm run dev`).
- Usuario autenticado como profesional de pruebas (usa el helper):
  - Visitar `/api/test-auth/login?email=pro.apply@handi.dev&role=pro&next=/pro-apply`.

## Pasos

1. Abrir `/pro-apply` y verificar que aparece la sección "Cuentas bancarias" debajo de "Referencias laborales".
2. Completar campos básicos del formulario (nombre, teléfono, correo, RFC válido, servicios, ciudades, categorías, años).
3. En "Cuentas bancarias":
   - Nombre del titular: escribir al menos 2 caracteres.
   - Banco: escribir nombre del banco (ej. "BBVA").
   - CLABE: pegar 18 dígitos (validar que el campo enmascara a grupos; si <18 dígitos, ver mensaje "CLABE incompleta").
   - Tipo de cuenta (opcional): seleccionar alguna (Ahorro/Nómina/Otra).
   - Carátula (opcional): subir un PDF o imagen < 10MB.
4. Adjuntar firma (abrir modal, dibujar y aceptar). Aceptar Aviso de Privacidad.
5. Enviar postulación.

## Verificaciones

- Frontend
  - La CLABE muestra mensajes en vivo: incompleta y DV inválido.
  - El submit bloquea cuando CLABE no es de 18 dígitos o el DV no coincide.
  - El uploader permite PDF/JPG/PNG y rechaza >10MB.

- Backend / DB
  - Se llamó `POST /api/me/bank-account` con `account_holder_name`, `bank_name`, `clabe` (18 dígitos), y opcionales `account_type`, `verification_document_url`, `rfc`.
  - La API valida CLABE (18 dígitos + dígito verificador) antes de confirmar la cuenta.

- Settings
  - Abrir `/settings` → "Cuentas bancarias (Profesional)" y verificar que la cuenta aparece.
  - Si ya existía una confirmada, la nueva queda confirmada y la previa archivada (política: una confirmada por perfil).

- Postulación
  - En la notificación/correo de admins (si aplica), verificar que aparece el enlace de carátula (`uploads.bank_cover_url`) cuando fue adjuntada.

## Criterios de "Hecho"

- La CLABE se valida en el front (máscara + mensajes) y en la API (18 dígitos + DV).
- La cuenta creada/actualizada desde `/pro-apply` aparece correctamente en `/settings`.
- El uploader guarda `verification_document_url` en `bank_accounts` y es opcional.
- No se rompen flujos existentes: /settings sigue listando cuentas; `/api/bank-accounts` y `/api/me/bank-account` operan normal.
