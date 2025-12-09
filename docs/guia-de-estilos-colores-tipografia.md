# Guía de Estilos: Colores y Tipografías (Handi)

Esta guía define los colores y tipografías de la web para mantener consistencia. Se apoya en Tailwind y variables CSS ya declaradas en `app/globals.css` (OKLCH), más utilidades de shadcn/ui.

## Paleta Base (variables CSS)

- Background: `--background` / Texto: `--foreground`
- Superficies: `--card`, `--popover` (+ sus `-foreground`)
- Accentos y estados suaves: `--secondary`, `--muted`, `--accent` (+ sus `-foreground`)
- Primario: `--primary`, `--primary-foreground`
- Bordes y focus: `--border`, `--input`, `--ring`
- Destructivo: `--destructive`

Las variables están mapeadas a tokens de Tailwind vía `@theme inline` en `app/globals.css` (por ejemplo, `--color-primary` apunta a `--primary`). Úsalas con clases Tailwind como `bg-primary`, `text-foreground`, `border-input`, `ring-ring`, etc.

## Marca

- Color de marca (primario): `#082877`
  - Texto: clase utilitaria `.text-brand`
  - Fondo: clase utilitaria `.bg-brand`
  - Uso: botones y CTAs primarios, titulares discretos, logotipo. Evitar grandes bloques de texto con color de marca.

- Color secundario: `#F9E7D2`
  - Uso: superficies suaves (chips, badges, secciones destacadas ligeras), `variant="secondary"` en botones.
  - Contraste en dark: texto sobre secundario usa `--secondary-foreground` ajustado a `#001447`.

## Header (tinte gris translúcido)

- Fondo (claro): `bg-neutral-50/80`
- Fondo (oscuro): `dark:bg-neutral-900/40`
- Borde: `border-border`
- Blur: `backdrop-blur-md`

Referencia de implementación: `components/site-header.tsx`.

## Capas y Fondos

- Página (body): `bg-background text-foreground`
- Bloques/superficies (cards, sheets): `bg-card text-card-foreground` o `bg-popover text-popover-foreground`
- Secciones suaves: `bg-muted text-muted-foreground` o `bg-secondary text-secondary-foreground`

## Texto

- Primario: `text-foreground`
- Secundario: `text-muted-foreground`
- Inverso sobre primario: `text-primary-foreground`
- Estados:
  - Destructivo: usa `text-destructive` cuando aplique (o botones `variant="destructive"`)
  - Éxito/Advertencia/Info: usar escala Tailwind por defecto (ej.: `text-emerald-600`, `text-amber-600`, `text-sky-700`) de forma consistente en todo el sitio.

## Botones (shadcn/ui)

- `variant="default"`: `bg-primary text-primary-foreground`
- `variant="secondary"`: `bg-secondary text-secondary-foreground`
- `variant="outline"`: `border bg-background` (hover `bg-accent`)
- `variant="ghost"`: `hover:bg-accent hover:text-accent-foreground`
- `variant="destructive"`: `bg-destructive text-white`

Tamaños: `sm`, `default`, `lg`, `icon`.

## Bordes, Inputs y Focus

- Borde neutro: `border-border`
- Controles: `border-input bg-background` (modo oscuro: `dark:bg-input/30`)
- Focus visible: `ring-ring/50` + `focus-visible:ring-[3px]`

## Estados Semánticos (recomendados)

- Éxito: `bg-emerald-50 text-emerald-700 border-emerald-200`
- Info: `bg-sky-50 text-sky-700 border-sky-200`
- Advertencia: `bg-amber-50 text-amber-800 border-amber-200`
- Error: `bg-red-50 text-red-700 border-red-200` o `bg-destructive`

## Tipografías

- Familia (por defecto Tailwind): `font-sans` (stack del sistema). Monoespaciada: `font-mono` para IDs, código y hashes.
- Pesos: `font-normal`, `font-medium`, `font-semibold`, `font-bold`
- Jerarquía sugerida:
  - H1: `text-3xl md:text-4xl font-bold`
  - H2: `text-2xl font-semibold`
  - H3: `text-xl font-semibold`
  - Párrafo: `text-base text-foreground`
  - Secundario: `text-sm text-muted-foreground`
  - Leyendas/Notas: `text-xs text-muted-foreground`

Si en el futuro se incorpora una fuente de marca (via `next/font`), documentar aquí el `font-family` y sus usos.

## Ejemplos de uso

- Sección con encabezado:
  - Contenedor: `bg-card border border-border rounded-lg`
  - Título: `text-2xl font-semibold text-foreground`
  - Descripción: `text-sm text-muted-foreground`

- CTA primario:
  - `<Button variant="default" />` → usa `--primary`

- Tag/lozenge informativo:
  - `inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs text-sky-700`

## Cómo proponer cambios

1. Ajusta variables en `app/globals.css` (bloques `:root` y `.dark`).
2. Para el header, modifica en `components/site-header.tsx` las clases `bg-[rgba(...)]` y `dark:bg-[rgba(...)]` y los `border-*`.
3. Valida en local: `npm run dev` (y `npm run build` en CI).

Mantén nombres y tokens; evita usar colores “sueltos” fuera de esta guía (salvo casos documentados como el header).
