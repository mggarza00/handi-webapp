# Handee Webapp

Next.js 14 (App Router) + Google Sheets (Service Account).

## Requisitos
- Node.js 18+
- NPM o PNPM
- Acceso a Google Sheet (Service Account con permiso Editor)

## Variables de entorno
Copia `.env.example` a `.env.local` y rellena:
- `PROJECT_ID`
- `CLIENT_EMAIL`
- `PRIVATE_KEY` (usar `\n` en una sola línea si el código hace `replace(/\\n/g, '\n')`)
- `SHEET_ID`

## Desarrollo local
```bash
npm install
npm run check        # typecheck + lint (opcional pero recomendado)
npm run dev          # http://localhost:3000
