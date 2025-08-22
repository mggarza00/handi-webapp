import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { RequestCreateSchema } from "@/lib/validators/requests";

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
  const mine = searchParams.get("mine") === "1";
  const status = searchParams.get("status") ?? undefined;
  const city = searchParams.get("city") ?? undefined;

  const supabase = getSupabase();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr) return NextResponse.json({ error: userErr.message }, { status: 401 });

  let query = supabase.from("requests").select("*").order("created_at", { ascending: false }).limit(50);

  if (mine && user?.id) query = query.eq("created_by", user.id);
  if (status) query = query.eq("status", status);
  if (city) query = query.eq("city", city);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data });
}

// POST /api/requests
export async function POST(req: Request) {
  const supabase = getSupabase();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = RequestCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validación", details: parsed.error.flatten() }, { status: 422 });
  }

  const payload = parsed.data;
  const insert = {
    title: payload.title,
    description: payload.description,
    city: payload.city,
    category: payload.category,
    subcategories: payload.subcategories ?? [],
    budget: payload.budget ?? null,
    required_at: payload.required_at ?? null,
    attachments: payload.attachments ?? [],
    created_by: user.id, // RLS exige que sea = auth.uid()
  };

  const { data, error } = await supabase.from("requests").insert(insert).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, data }, { status: 201 });
}
