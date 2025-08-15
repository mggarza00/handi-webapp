import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

type ReqBody = {
  title: string;
  description?: string;
  city?: string;
  category?: string;
  subcategories?: Array<{ id: string; name: string }>|string[]|null;
  budget?: number|null;
  required_at?: string|null; // YYYY-MM-DD
  attachments?: Array<{ url: string; mime?: string; size?: number }>|null;
};

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code, headers: { "Content-Type": "application/json; charset=utf-8" } });
}

export async function GET() {
  const supabase = getSupabaseServer();

  // RLS ya limita: (status='active') OR (created_by=auth.uid())
  const { data, error } = await supabase
    .from("requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return bad(`DB_ERROR: ${error.message}`, 500);
  }

  return NextResponse.json({ ok: true, data }, { headers: { "Content-Type": "application/json; charset=utf-8" } });
}

export async function POST(req: Request) {
  if (req.headers.get("content-type")?.toLowerCase().includes("application/json") !== true) {
    return bad("CONTENT_TYPE_REQUIRED: application/json; charset=utf-8");
  }

  const supabase = getSupabaseServer();

  // Requiere sesión
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user?.id) {
    return bad("UNAUTHORIZED: inicia sesión", 401);
  }

  let body: ReqBody;
  try {
    body = await req.json();
  } catch {
    return bad("INVALID_JSON");
  }

  // Validación mínima
  const title = (body.title || "").toString().trim();
  if (title.length < 4) return bad("TITLE_MIN_4");
  const description = (body.description ?? "").toString().trim();
  const city = (body.city ?? "").toString().trim();
  const category = (body.category ?? "").toString().trim();

  // Normalización de subcategorías
  let subcategories: any = null;
  if (Array.isArray(body.subcategories)) {
    // admitir string[] o {id,name}[]
    subcategories = body.subcategories.map((s: any) =>
      typeof s === "string" ? { id: s, name: s } : { id: String(s.id ?? s.name ?? ""), name: String(s.name ?? s.id ?? "") }
    );
  }

  // Budget numérico opcional
  let budget: number|null = null;
  if (body.budget !== undefined && body.budget !== null) {
    const n = Number(body.budget);
    if (Number.isNaN(n) || n < 0) return bad("BUDGET_INVALID");
    budget = n;
  }

  // Fecha requerida opcional (YYYY-MM-DD)
  let required_at: string|null = null;
  if (body.required_at) {
    const iso = String(body.required_at);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return bad("REQUIRED_AT_FORMAT_YYYY_MM_DD");
    required_at = iso;
  }

  // Attachments opcional
  const attachments = Array.isArray(body.attachments) ? body.attachments : null;

  const payload = {
    title,
    description: description || null,
    city: city || null,
    category: category || null,
    subcategories: subcategories ?? null,
    budget,
    required_at,
    attachments: attachments ?? null,
    created_by: user.id, // RLS exige que coincida con auth.uid()
    status: "active" as const,
  };

  const { data, error } = await supabase
    .from("requests")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    // Errores típicos RLS/constraints
    return bad(`DB_ERROR: ${error.message}`, 400);
  }

  return NextResponse.json({ ok: true, data }, { status: 201, headers: { "Content-Type": "application/json; charset=utf-8" } });
}
