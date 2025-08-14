import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

function json(data: unknown, init?: number | ResponseInit) {
  const res = NextResponse.json(data, typeof init === "number" ? { status: init } : init);
  res.headers.set("Content-Type", "application/json; charset=utf-8");
  return res;
}

function getSupabase() {
  const cookieStore = cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!url || !anon) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options: any) {
        cookieStore.set({ name, value: "", ...options });
      },
    },
  });
}

// GET /api/requests  â†’ lista (RLS aplica: activas + propias)
// Soporta ?limit= & ?offset=
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();

    const { data: { user } } = await supabase.auth.getUser();
    // No es estrictamente obligatorio para ver requests activas,
    // pero lo solicitamos para que RLS permita tambiÃ©n "propias".
    if (!user) {
      // usuario anÃ³nimo: sÃ³lo verÃ¡ activas por polÃ­tica RLS
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.max(1, Math.min(50, Number(searchParams.get("limit") ?? 20)));
    const offset = Math.max(0, Number(searchParams.get("offset") ?? 0));

    const { data, error } = await supabase
      .from("requests")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return json({ ok: false, error: error.message }, { status: 400 });
    return json({ ok: true, data });
  } catch (err: any) {
    return json({ ok: false, error: err?.message ?? "Error inesperado" }, { status: 500 });
  }
}

// POST /api/requests â†’ crear (RLS: created_by debe ser el usuario actual)
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ ok: false, error: "No autenticado" }, { status: 401 });

    const body = await req.json();

    // Validaciones mÃ­nimas
    const title = String(body?.title ?? "").trim();
    if (!title) return json({ ok: false, error: "title es requerido" }, { status: 400 });

    const payload = {
      title,
      description: body?.description ?? null,
      city: body?.city ?? null,
      category: body?.category ?? null,
      subcategories: Array.isArray(body?.subcategories) ? body.subcategories : [],
      budget: body?.budget ?? null,
      required_at: body?.required_at ?? null,
      attachments: Array.isArray(body?.attachments) ? body.attachments : [],
      created_by: user.id, // Â¡Clave para pasar RLS!
    };

    const { data, error } = await supabase
      .from("requests")
      .insert(payload)
      .select("*")
      .single();

    if (error) return json({ ok: false, error: error.message }, { status: 400 });
    return json({ ok: true, data }, { status: 201 });
  } catch (err: any) {
    return json({ ok: false, error: err?.message ?? "Error inesperado" }, { status: 500 });
  }
}

