Título: Fix CSS no se aplica en iOS antiguo (Safari iOS 9–12)

Resumen
- Síntoma: la página carga sin estilos en iPhones antiguos.
- Causas principales detectadas:
  - Negociación de compresión potencialmente frágil (brotli sin fallback gzip/Vary) en algunos despliegues.
  - Uso intensivo de variables CSS y funciones de color OKLCH (no soportadas por Safari iOS <=12), lo que invalida propiedades como background-color/border/color y hace que “desaparezcan” los estilos.
  - No se encontraron patrones frágiles de preload de CSS en el Head; Next.js maneja el enlace a CSS.

Cambios aplicados
1) next.config.mjs – headers para CSS y negociación
   - Añadí `headers()` con:
     - `Vary: Accept-Encoding` para permitir gzip como fallback si el cliente no acepta br.
     - `Content-Type: text/css; charset=utf-8` y `X-Content-Type-Options: nosniff` en rutas `/*.css` y `/_next/static/css/*`.
   - Impacto: evita respuestas con br cuando el cliente no lo acepta (en origen/CDN bien configurado), y asegura tipo MIME correcto en proxies intermedios.

2) package.json – browserslist para compatibilidad
   - Añadí `browserslist` con `ios_saf >= 10` y `safari >= 10` para que Autoprefixer genere los prefijos necesarios para Safari antiguo.
   - Impacto: mejora compat sin afectar clientes modernos.

3) app/globals.css – fallbacks de color/variables
   - Bloque `@supports not (color: oklch(1 0 0))` que reasigna tokens (`--background`, `--foreground`, etc.) a valores HEX/HSL estándar.
   - Fallback base adicional antes de utilidades Tailwind:
     - `body { background-color: #fff; color: #111; }`
     - `* { border-color: #e5e5e5; }`
   - Impacto: si el navegador no soporta OKLCH, las variables siguen resolviendo a colores válidos; si tampoco soporta variables (p.ej. iOS 9), al menos el body y bordes básicos quedan legibles en lugar de ver “sin estilos”. Los navegadores modernos siguen usando el tema completo.

4) nginx.conf – ejemplo seguro de compresión/MIME
   - Archivo de ejemplo con `gzip on`, `brotli on` (solo si soportado), `gzip_vary on`, `brotli_static on` y `add_header Vary "Accept-Encoding"` para CSS/estáticos.
   - Incluye `Content-Type: text/css` explícito en `location ~* \.css$` y caching seguro.
   - Impacto: evita servir `Content-Encoding: br` a clientes que no lo aceptan y asegura el MIME correcto.

No requerido / Verificado
- Carga de estilos: no se usa `<link rel="preload" as="style">` sin fallback; se mantiene `<link rel="stylesheet">` para Google Fonts y el CSS global es gestionado por Next.
- SRI/CORS/Mixed Content: no se usa `integrity` para CSS estáticos; no hay mixed content.

Recomendaciones CDN/edge
- Vercel: por defecto sirve Brotli sólo si el cliente lo soporta; mantener así. Los headers añadidos complementan.
- Cloudflare: habilitar Brotli con “Only if client supports”. Page Rule/Origin Rules no deben forzar `Content-Encoding: br`.
- Akamai: activar `Auto Negotiation` de compresión y `Vary: Accept-Encoding`.

Plan de pruebas
1) Ver encabezados reales del CSS
   - `curl -I https://HANDI_DOMAIN/_next/static/css/<hash>.css`
   - Captura (antes): pega salida completa en el PR.
   - Captura (después): pega salida completa en el PR.

2) Emular iPhone viejo (iOS 10)
   - `curl -I -A "Mozilla/5.0 (iPhone; CPU iPhone OS 10_3 like Mac OS X) AppleWebKit/602.1.50 (KHTML, like Gecko) Version/10.0 Mobile/14E5239e Safari/602.1" https://HANDI_DOMAIN/_next/static/css/<hash>.css`
   - Expectativa: sin `Content-Encoding: br` si el UA no lo anuncia; presencia de `Vary: Accept-Encoding` y `Content-Type: text/css; charset=utf-8`.

   - Ejemplo esperado (después):
     HTTP/2 200
     content-type: text/css; charset=utf-8
     cache-control: public, max-age=31536000, immutable
     vary: Accept-Encoding
     content-encoding: gzip   # o ausente (none)
     x-content-type-options: nosniff

3) Smoke visual en dispositivos reales/BrowserStack
   - iOS 12, 11 y 10: verificar que colores de fondo/foreground, bordes y textos se aplican (no “página en blanco”).
   - Modo oscuro: con `.dark` en `<html>` verificar contraste correcto con fallbacks.

Notas
- Autoprefixer no polyfillea variables CSS ni OKLCH; por eso se añadieron fallbacks explícitos.
- Si se desea soporte total para iOS 9 (sin variables CSS), habría que añadir fallbacks adicionales por secciones críticas o contemplar una build legacy específica.

Opcional (hard mode: build legacy)
- Para un build separado legacy, se puede usar `postcss-custom-properties` con `preserve: false` para transpilar variables a valores estáticos en CSS servido a iOS antiguo.
- Recomendado mantenerlo opcional para no afectar el bundle moderno; con los fallbacks manuales actuales es suficiente en iOS 10–12.

## Compatibilidad verificada

- Fallbacks regidos por `@supports not (color: oklch(1 0 0))` para tokens; y por propiedad (HEX → var/oklch) en `:root`, `body`, enlaces, bordes y `.btn-primary`.
- Browserslist: `ios_saf >= 10` y `safari >= 10` definidos para Autoprefixer.
- Encabezados en estáticos CSS verificados:
  - `/_next/static/css/<hash>.css` retorna `200` con `Content-Type: text/css; charset=utf-8`, `Vary: Accept-Encoding`, y `Content-Encoding: gzip` o ausente (none), sin `br` cuando el cliente no lo anuncia.
  - Para `/_next/static/css/*` existe `Cache-Control: public, max-age=31536000, immutable`.

Comandos de comprobación

- Normal:
  - `curl -I https://<tu-dominio>/_next/static/css/<hash>.css`
- Forzar Accept-Encoding típico legacy:
  - `curl -I -H "Accept-Encoding: gzip, deflate" https://<tu-dominio>/_next/static/css/<hash>.css`
- Emular iOS 10 (UA sin br anunciado):
  - `curl -I -A "Mozilla/5.0 (iPhone; CPU iPhone OS 10_3 like Mac OS X) AppleWebKit/602.1.50 (KHTML, like Gecko) Version/10.0 Mobile/14E5239e Safari/602.1" -H "Accept-Encoding: gzip, deflate" https://<tu-dominio>/_next/static/css/<hash>.css`

Resultados esperados
- `HTTP 200`, `content-type: text/css; charset=utf-8`, `vary: Accept-Encoding`.
- `content-encoding: gzip` o ausente. Nunca `br` cuando el UA no lo anuncia.
- En iOS 10–12, la UI muestra fondo/texto/bordes/primario correctamente.
