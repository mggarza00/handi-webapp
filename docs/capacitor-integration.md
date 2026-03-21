# Capacitor Integration (Fase 1)

## Estrategia elegida (menor riesgo)

Se integró **Capacitor apuntando a una app web remota** mediante `server.url` en `capacitor.config.ts`.

Motivo:

- Este proyecto usa Next.js 14 App Router (SSR/server actions) y ya tiene PWA funcional.
- Forzar `next export` o convertir a estático aumentaría riesgo de regresiones.
- Con `server.url`, la web/PWA sigue siendo la fuente principal y Capacitor actúa como wrapper híbrido para Android/iOS.

## Qué se instaló

- `@capacitor/core` (v7)
- `@capacitor/cli` (v7)
- `@capacitor/android` (v7)
- `@capacitor/ios` (v7)

> Nota: se usa Capacitor v7 para mantener compatibilidad con Node 20 del proyecto.

## Archivos creados/cambiados

- `capacitor.config.ts`
- `android/` (plataforma nativa)
- `ios/` (plataforma nativa)
- `package.json` (scripts `cap:*` y dependencias)
- `.gitignore` (artefactos locales de Android/iOS)

## Scripts agregados

- `npm run cap:sync`
- `npm run cap:copy`
- `npm run cap:add:android`
- `npm run cap:add:ios`
- `npm run cap:open:android`
- `npm run cap:open:ios`
- `npm run cap:update`

## Uso diario

### Web / PWA (sin cambios)

```bash
npm run dev
npm run build
npm run start
```

### Sincronizar cambios con nativo

```bash
npm run cap:sync
```

### Android

```bash
npm run cap:open:android
```

### iOS

```bash
npm run cap:open:ios
```

## Variables útiles

- `CAPACITOR_SERVER_URL` (prioritaria para wrapper nativo)
- `NEXT_PUBLIC_APP_URL` (fallback)

Si no se define ninguna, se usa `https://handi.mx`.

## Riesgos conocidos (fase actual)

- La app nativa depende de conectividad al backend/web remoto (no offline-first nativo).
- Web Push de la PWA web no se migra automáticamente a push nativo de Capacitor (son flujos distintos).
- En iOS se requiere macOS + Xcode + CocoaPods para compilación completa.

## Checklist manual de validación

1. Login (email y social) funciona dentro del WebView nativo.
2. Navegación principal carga rutas clave (`/`, `/pro`, `/requests`, `/profile/setup`).
3. Realtime (chat/updates) se mantiene funcional.
4. PWA web actual sigue operando igual en navegador (manifest + sw + web push).
5. No hay regresión visual evidente en páginas críticas.

## Próximos pasos recomendados (no implementados en esta fase)

1. Configurar deep links/universal links nativos.
2. Definir estrategia de push nativo (FCM/APNs) separada de web push.
3. Ajustar permisos nativos mínimos (cámara/galería/notificaciones) según features.
4. Preparar branding nativo (splash/iconos) para store release.
5. Agregar pipeline CI para `cap sync` + builds Android/iOS.

---

## Fase 2 - Validación y compatibilidad Android-first

### Ajustes mínimos aplicados

1. `android/app/src/main/AndroidManifest.xml`

- Se agregó `android:windowSoftInputMode="adjustResize"` en `MainActivity` para reducir solapamiento del teclado con inputs.
- Se agregaron permisos de ubicación:
  - `android.permission.ACCESS_COARSE_LOCATION`
  - `android.permission.ACCESS_FINE_LOCATION`
    (la app usa geolocalización en flujos de dirección/mapa).

2. `capacitor.config.ts`

- Se mantuvo estrategia `server.url` (web remota) para no romper Next.js App Router/PWA.
- Se removió `android.allowMixedContent: true` para evitar habilitar mixed content sin necesidad.

### Validación de puntos solicitados

- Auth/session en WebView:
  - Estrategia actual usa mismo dominio remoto por `server.url`; las cookies de sesión permanecen bajo ese origen.
  - No se cambiaron flujos de login.

- Navegación interna:
  - Sin cambios de rutas ni lógica de negocio.
  - La navegación sigue siendo la misma SPA/SSR de Next dentro del WebView.

- Enlaces externos:
  - Se dejó comportamiento por defecto de Capacitor/WebView para no introducir interceptores globales en esta fase.
  - Riesgo documentado abajo.

- Android back button:
  - Se mantiene comportamiento nativo por defecto de Capacitor en esta fase (sin hooks globales).
  - Riesgo documentado abajo.

- Keyboard resize/overlap:
  - Mitigado con `adjustResize` en la actividad Android.

- Safe areas / status bar:
  - Sin cambios adicionales en esta fase para evitar side effects visuales globales.

- Permisos básicos:
  - Ubicación agregada por uso real.
  - No se agregaron permisos de cámara/galería/notificaciones nativas todavía.

### Checklist exacta para Android físico

1. Instalar y abrir app en Android Studio:

```bash
npm run cap:sync
npm run cap:open:android
```

2. Autenticación:

- Login con correo.
- Login social (si aplica).
- Verificar que al cerrar y reabrir app conserve sesión.

3. Navegación crítica:

- `/`
- `/pro`
- `/requests`
- `/requests/new`
- `/profile/setup`
- Verificar navegación atrás/adelante en flujos normales.

4. Enlaces externos:

- Probar un link externo (`target="_blank"`) y confirmar comportamiento esperado en dispositivo (abre navegador o maneja WebView sin bloquear).

5. Back button Android:

- En pantalla interna, Back debe regresar en historial.
- En raíz, validar comportamiento final (cerrar/minimizar) y que no deje estado roto.

6. Teclado:

- Abrir formularios largos (`/auth/sign-in`, `/requests/new`, `/pro-apply`).
- Confirmar que input activo no quede oculto por teclado.

7. Geolocalización:

- En flujo de mapa/dirección, validar prompt de permiso y lectura de ubicación.
- Validar denegación de permiso sin crash.

8. Realtime:

- Probar chat/actualizaciones en tiempo real con dos cuentas.

9. PWA web (fuera de Capacitor):

- Verificar que manifest + service worker + web push en navegador sigan sin cambios.

### Riesgos pendientes antes de Play Store

1. Definir política explícita de enlaces externos:

- Si algún link externo debe abrir siempre fuera del WebView, implementar intercept controlado (fase posterior).

2. Ajustar comportamiento de back button para rutas específicas:

- Si se requiere UX más fina (doble tap para salir, etc.), implementar handler dedicado (fase posterior).

3. Push nativo:

- Actualmente solo está cubierto web push; para store release normalmente se requiere FCM nativo.

4. Permisos granulares:

- Revisar si cámara/archivos necesitan permisos nativos adicionales según dispositivos/SDK.

5. Hardening de red y dominios:

- Revisar lista de hosts permitidos en `allowNavigation` y dominios auxiliares (auth/mapas) en pruebas reales.

---

## Fase 3 - Android-first (enlaces externos + back button)

### Cambios mínimos implementados

1. Nuevo componente cliente:

- `components/capacitor/AndroidWebViewControls.client.tsx`

2. Montaje global:

- `app/layout.tsx` (se agregó `<AndroidWebViewControls />`)

### Qué hace y por qué

El control se activa **solo** en Android nativo (`Capacitor.isNativePlatform()` + `platform === "android"`):

1. Enlaces externos

- Intercepta clics en `<a href>` a nivel documento (captura).
- Si el enlace es externo (otro dominio o esquema especial), lo abre fuera de la app con `@capacitor/browser`.
- Si es interno del mismo dominio, permanece dentro de la app.
- Si un enlace interno tiene `target=\"_blank\"`, se fuerza navegación en la misma vista para no abrir ventanas nuevas.

2. `window.open(...)`

- En Android nativo, se sobreescribe de forma conservadora:
  - URL interna: navega en la app (`window.location.assign`).
  - URL externa: abre navegador nativo con `Browser.open`.

3. Back button Android

- Escucha `backButton` con `@capacitor/app`.
- Si hay historial navegable (`canGoBack` o `window.history.length > 1`): hace `history.back()`.
- Si no hay historial: minimiza la app (`App.minimizeApp()`).

### Alcance y seguridad

- No se tocaron rutas, negocio, auth, notificaciones ni PWA web.
- No se agregaron cambios de UI.
- Implementación reversible: quitar componente y su montaje en layout revierte el comportamiento.

### Checklist manual exacta (Android físico)

1. Preparación

```bash
npm run cap:sync
npm run cap:open:android
```

2. Navegación interna

- Abrir rutas internas (`/`, `/requests`, `/profile/setup`) y confirmar que todo permanece dentro de la app.
- Probar enlaces internos con `target=\"_blank\"` (si existen) y confirmar que no salen a navegador externo.

3. Enlaces externos

- Desde cualquier botón/enlace externo (por ejemplo, links salientes), confirmar que abre navegador nativo.
- Regresar a la app desde Android recents y verificar estado estable.

4. Back button

- Dentro de flujo con historial: debe regresar a la pantalla anterior.
- En ruta raíz/sin historial: debe minimizar app (no crash, no pantalla en blanco).

5. Retorno desde navegador externo

- Abrir enlace externo -> volver a la app y validar sesión/navegación intacta.

### Riesgos pendientes antes de Play Store

1. Política avanzada de dominios externos

- Actualmente es por comparación de `origin`; si se requieren excepciones/subdominios, definir allowlist explícita.

2. UX de salida en back button

- Hoy minimiza app cuando no hay historial; podría ajustarse a doble-back-to-exit si producto lo requiere.

3. Deep links

- Aún no se implementan app links/universal links.

4. Push nativo

- Sigue pendiente migración a FCM/APNs (se mantiene web push web sin cambios).

---

## Fase 4 - Android real-device QA + preparación mínima para Internal Testing

### Plan breve

1. Validar riesgos reales en dispositivo físico sin tocar arquitectura/PWA.
2. Ajustar solo configuración mínima para navegación estable.
3. Dejar checklist de pruebas y pasos de release interna (Play Console).

### Ajuste mínimo aplicado

1. `capacitor.config.ts`

- `server.allowNavigation` ahora incluye de forma explícita y deduplicada:
  - host principal de `server.url`
  - `handi.mx`
  - `www.handi.mx`

Motivo:

- evitar bloqueos de navegación interna si hay redirecciones entre dominio raíz y `www` durante pruebas reales.
- cambio reversible y sin impacto en negocio/UI.

### Checklist manual exacta (Android físico)

1. Build/sync

```bash
npm run cap:sync
npm run cap:open:android
```

2. Sesión y auth

- Login con correo.
- Cerrar y reabrir app.
- Confirmar que sesión persiste.

3. Rutas críticas

- `/`
- `/pro`
- `/requests`
- `/profile/setup`
- `/messages`
- Confirmar render y navegación sin pantallas en blanco.

4. Enlaces externos/internos

- Link interno normal: abre dentro de app.
- Link interno con `target="_blank"`: permanece en app.
- Link externo: abre navegador.
- Volver a la app desde recientes: estado/sesión intactos.

5. Back button

- Con historial: regresa a vista anterior.
- Sin historial: minimiza app.
- Reabrir app y confirmar estado estable.

6. Teclado y formularios

- Probar en `/auth/sign-in`, `/pro-apply`, `/requests/new`.
- Confirmar que inputs no quedan ocultos (resize correcto).

7. Ubicación

- Probar flujo de mapa/dirección.
- Aceptar/denegar permiso y confirmar que no hay crash.

8. Estado de red

- Cambiar entre Wi-Fi y datos móviles.
- Validar recuperación al volver conectividad.

### Preparación mínima para Play Console (Internal Testing)

1. En Android Studio:

- `Build > Generate Signed Bundle / APK`
- elegir **Android App Bundle (.aab)**.

2. Firma:

- crear/usar keystore de release.
- guardar credenciales fuera del repo.

3. Versionado:

- incrementar `versionCode` y `versionName` en `android/app/build.gradle` para cada subida.

4. Publicación interna:

- subir `.aab` a Play Console > Internal testing.
- agregar testers por correo.
- validar instalación desde enlace de testing.

### Pendientes antes de producción en Play Console

1. Push nativo (FCM) si se requiere fuera de web push.
2. Deep links/App Links.
3. Política de privacidad/permisos definitiva en ficha de Play.
4. Hardening de dominios permitidos si se agregan más hosts oficiales.
5. Estrategia de manejo offline/error de red en wrapper nativo.

### Deliberadamente no tocado en esta fase

1. Arquitectura Next.js/PWA y service worker web.
2. Flujos de negocio, auth lógica y routing del producto.
3. Notificaciones nativas (solo web push existente).
4. iOS y ajustes específicos de Xcode.
5. Refactors de performance o UI.

---

## Fase 5 - Preparación mínima para Play Console Internal Testing (Android)

### Plan breve

1. Confirmar que la configuración Android actual permite generar un `.aab`.
2. Evitar cambios de arquitectura/UI y mantener release mínima.
3. Documentar proceso exacto de firma, build y carga en Internal Testing.

### Revisión de configuración (estado actual)

- Nombre visible app: `Handi` (`android/app/src/main/res/values/strings.xml`).
- `applicationId`: `com.handi.webapp` (`android/app/build.gradle`).
- `versionCode/versionName`: definidos en `android/app/build.gradle` (actualmente `1` / `1.0`).
- Build release Android: ya configurada (`buildTypes.release`).
- Compilación: `targetSdkVersion = 35` (apto para requisitos recientes).
- Ícono/splash: presentes por configuración base de Capacitor.

Conclusión:

- No se detectó bloqueador técnico para Internal Testing.
- No se aplicaron cambios de código adicionales en esta fase para mantener estabilidad.

### Pasos exactos para generar Android App Bundle (AAB)

#### Opción recomendada (Android Studio)

1. Sincronizar nativo con web:

```bash
npm run cap:sync
```

2. Abrir Android Studio:

```bash
npm run cap:open:android
```

3. En Android Studio:

- `Build` > `Generate Signed Bundle / APK`
- Seleccionar `Android App Bundle`
- `Next`

4. Crear o usar keystore:

- Si es primera vez: `Create new...`
- Guardar `.jks` en ubicación segura fuera del repo
- Guardar contraseñas en gestor seguro

5. Seleccionar variante:

- `release`

6. Generar bundle:

- Resultado esperado: `android/app/release/app-release.aab`

#### Opción CLI (si ya existe firma en Gradle local)

```bash
cd android
gradlew.bat bundleRelease
```

> Nota: requiere configuración de firma release en entorno local si no usas el wizard de Android Studio.

### Publicación en Play Console Internal Testing

1. Crear app en Play Console (si no existe).
2. Completar datos mínimos de ficha:

- nombre app
- categoría
- datos de contacto
- política de privacidad (URL válida)

3. Ir a `Testing` > `Internal testing`.
4. Crear release.
5. Subir `app-release.aab`.
6. Completar notas de versión internas.
7. Agregar testers (emails o grupo de Google).
8. Publicar release interna.
9. Validar instalación con enlace de tester.

### Checklist pre-upload (Internal Testing)

1. `npm run lint` en verde.
2. `npm run cap:sync` sin errores.
3. `applicationId` correcto (`com.handi.webapp` o el definitivo).
4. `versionCode` incrementado respecto al último upload.
5. `versionName` coherente con release.
6. AAB firmado con keystore de release.
7. Smoke test en Android físico:

- login
- navegación crítica (`/`, `/pro`, `/requests`, `/profile/setup`)
- links externos e internos
- back button
- teclado en formularios

8. Revisar permisos declarados:

- `INTERNET`
- `ACCESS_COARSE_LOCATION`
- `ACCESS_FINE_LOCATION`

9. Validar que política de privacidad y formulario de datos en Play reflejen esos permisos.

### Pendientes fuera de alcance (siguen para fases posteriores)

1. Push nativo (FCM) y permisos asociados.
2. Deep links / App Links.
3. Hardening de seguridad de red y dominios externos finos.
4. Automatización CI/CD para build y firma de AAB.
5. iOS (Xcode/TestFlight/App Store).
