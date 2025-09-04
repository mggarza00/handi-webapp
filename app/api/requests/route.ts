import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { RequestCreateSchema, RequestListQuerySchema } from "@/lib/validators/requests";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

function getSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );
}

// GET /api/requests?mine=1&status=active&city=Monterrey
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const qp = {
    mine: searchParams.get("mine") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    city: searchParams.get("city") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    offset: searchParams.get("offset") ?? undefined,
    cursor: searchParams.get("cursor") ?? undefined,
    dir: searchParams.get("dir") ?? undefined,
  };

  const parsed = RequestListQuerySchema.safeParse(qp);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validación", details: parsed.error.flatten() },
      { status: 422, headers: JSONH },
    );
  }

  const mine = parsed.data.mine === "1" || parsed.data.mine === "true";
  const { status, city, category, limit, offset, cursor, dir } = parsed.data;

  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Si falla la obtención del usuario, continuamos como anónimo (RLS permite ver activas)

  let query = supabase.from("requests").select("*").order("created_at", { ascending: false });

  if (mine && user?.id) query = query.eq("created_by", user.id);
  if (status) query = query.eq("status", status);
  else if (!mine) query = query.eq("status", "active"); // default: solo activas si no se piden propias
  if (city) query = query.eq("city", city);
  if (category) query = query.eq("category", category);

  // Cursor tiene prioridad si se envía
  if (cursor) {
    // dir=next: elementos más antiguos que cursor (created_at < cursor)
    // dir=prev: elementos más nuevos que cursor (created_at > cursor)
    if (dir === "prev") query = query.gt("created_at", cursor);
    else query = query.lt("created_at", cursor);
    query = query.limit(limit ?? 20);
  } else if (typeof offset === "number") {
    query = query.range(offset, offset + (limit ?? 20) - 1);
  } else {
    query = query.limit(limit ?? 20);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400, headers: JSONH });

  // Siguiente cursor: último created_at del page si alcanzó el límite
  let nextCursor: string | null = null;
  if ((limit ?? 20) && Array.isArray(data) && data.length === (limit ?? 20)) {
    const last = data[data.length - 1] as { created_at?: string };
    if (last?.created_at) nextCursor = new Date(last.created_at).toISOString();
  }
  return NextResponse.json({ ok: true, data, nextCursor }, { headers: JSONH });
}

// POST /api/requests
export async function POST(req: Request) {
  const ct = (req.headers.get("content-type") || "").toLowerCase();
  if (!ct.includes("application/json")) {
    return NextResponse.json({ error: "UNSUPPORTED_MEDIA_TYPE" }, { status: 415, headers: JSONH });
  }
  const supabase = getSupabase();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401, headers: JSONH });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400, headers: JSONH });
  }

  // Normaliza required_at si viene como ISO (YYYY-MM-DDTHH:mm:ssZ)
  if (body && typeof (body as Record<string, unknown>).required_at === "string") {
    const s = (body as Record<string, string>).required_at;
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) (body as Record<string, string>).required_at = m[1];
  }

  const parsed = RequestCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validación", details: parsed.error.flatten() },
      { status: 422, headers: JSONH },
    );
  }

  const payload = parsed.data;
  const insert = {
    title: payload.title,
    description: payload.description ?? null,
    city: payload.city,
    category: payload.category ?? null,
    subcategories: payload.subcategories ?? [],
    budget: payload.budget ?? null,
    required_at: payload.required_at ?? null,
    attachments: payload.attachments ?? [],
    created_by: user.id, // RLS exige que sea = auth.uid()
  };

  const { data, error } = await supabase.from("requests").insert(insert).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400, headers: JSONH });

  return NextResponse.json({ ok: true, data }, { status: 201, headers: JSONH });
}
