# Handee Webapp (Next.js + Tailwind)

Stack:
- Next.js (App Router)
- React 18
- TailwindCSS
- next-themes (modo oscuro)
- lucide-react (íconos)

## Desarrollo
```bash
npm install
npm run dev
```
Abre http://localhost:3000

## Estructura
- `/app` páginas (landing, dashboard, solicitudes, profesionales).
- `/components` UI básica (botón, card, navbar, sidebar, paleta de comandos).
- `/lib/cn.ts` util de clases.
- Modo oscuro con `next-themes` y toggle en Navbar.
- Paleta de comandos (Ctrl/Cmd + K).

## Personalizar
- Cambia textos en `app/page.tsx` y logo en `components/navbar.tsx`.
- Agrega llamadas reales a API/DB en páginas del grupo `(app)`.
