// lib/fonts.ts
import fs from "node:fs";
import path from "node:path";

import { Concert_One, Inter, Nunito, Varela_Round } from "next/font/google";

let interData: ArrayBuffer | null = null;
// Expose chosen font path for diagnostics
declare global {
  // eslint-disable-next-line no-var
  var __SATORI_FONT_PATH__: string | undefined;
}

export async function getInterFont(): Promise<ArrayBuffer> {
  if (interData) return interData;
  const candidates = [
    path.join(
      process.cwd(),
      "public",
      "fonts",
      "Inter-VariableFont_slnt,wght.ttf",
    ),
    path.join(process.cwd(), "public", "fonts", "Inter-VariableFont.ttf"),
    // Fallback seguro a TTF local existente (evitar WOFF2: Satori no soporta wOF2)
    path.join(process.cwd(), "public", "fonts", "Comfortaa-Bold.ttf"),
    // Fallback a @fontsource/inter si está instalado
    path.join(
      process.cwd(),
      "node_modules",
      "@fontsource",
      "inter",
      "files",
      "inter-latin-400-normal.ttf",
    ),
    // OS-level common fonts (Debian/Ubuntu Alpine images)
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
  ];
  for (const p of candidates) {
    try {
      const buf = fs.readFileSync(p);
      interData = buf.buffer.slice(
        buf.byteOffset,
        buf.byteOffset + buf.byteLength,
      );
      try {
        globalThis.__SATORI_FONT_PATH__ = p;
      } catch {
        /* ignore */
      }
      if (
        process.env.SATORI_FONT_DEBUG === "1" ||
        process.env.NODE_ENV !== "production"
      ) {
        // eslint-disable-next-line no-console
        console.debug(`[satori-font] using ${p}`);
      }
      return interData!;
    } catch {
      // try next
    }
  }
  throw new Error(
    "No se encontró una fuente TTF compatible (Inter). Agrega /public/fonts/Inter-VariableFont.ttf.",
  );
}

// Site font exports used by app/layout.tsx
export const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito" });
export const varelaRound = Varela_Round({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-varela",
});
export const concertOne = Concert_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-concert",
});
export const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});
