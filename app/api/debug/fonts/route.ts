import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getInterFont } from "@/lib/fonts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const candidates = [
    path.join(process.cwd(), "public", "fonts", "Inter-VariableFont_slnt,wght.ttf"),
    path.join(process.cwd(), "public", "fonts", "Inter-VariableFont.ttf"),
    path.join(process.cwd(), "public", "fonts", "Comfortaa-Bold.ttf"),
    path.join(process.cwd(), "node_modules", "@fontsource", "inter", "files", "inter-latin-400-normal.ttf"),
  ];
  const results = candidates.map((p) => {
    try {
      const stat = fs.statSync(p);
      return { path: p, exists: true, size: stat.size };
    } catch {
      return { path: p, exists: false };
    }
  });
  // @ts-ignore
  let used = (globalThis as any).__SATORI_FONT_PATH__ || null;
  let loaded = false;
  let error: string | null = null;
  if (!used) {
    try {
      await getInterFont();
      // @ts-ignore
      used = (globalThis as any).__SATORI_FONT_PATH__ || null;
      loaded = true;
    } catch (e: any) {
      error = e?.message || String(e);
    }
  }
  return NextResponse.json({ ok: true, used, loaded, error, candidates: results });
}
