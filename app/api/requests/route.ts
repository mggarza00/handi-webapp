import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import {
  RequestCreateSchema,
  RequestListQuerySchema,
} from "@/lib/validators/requests";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { createBearerClient } from "@/lib/supabase";
import type { Database } from "@/types/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

function getSupabase() {
  return createRouteHandlerClient<Database>({ cookies });
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
  let userId: string | null = null;

  const authHeader = (req.headers.get("authorization") || req.headers.get("Authorization") || "").trim();
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = bearerMatch?.[1] || (req.headers.get("x-access-token") || "").trim();
  if (token) {
    try {
      const bearer = createBearerClient(token);
      const { data, error } = await bearer.auth.getUser(token);
      if (!error && data?.user) userId = data.user.id;
    } catch {
      /* ignore bearer failures */
    }
  }
  if (!userId) {
    const xuid = (req.headers.get("x-user-id") || "").trim();
    if (xuid) userId = xuid;
  }
  if (!userId) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      userId = user?.id ?? null;
    } catch {
      /* ignore cookie-based auth failures */
    }
  }
  if (mine && !userId) {
    return NextResponse.json({ ok: true, data: [], nextCursor: null }, { status: 200, headers: JSONH });
  }
  let query = supabase
    .from("requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (mine && userId) query = query.eq("created_by", userId);
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
  if (error)
    return NextResponse.json(
      { error: error.message },
      { status: 400, headers: JSONH },
    );

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
    return NextResponse.json(
      { error: "UNSUPPORTED_MEDIA_TYPE" },
      { status: 415, headers: JSONH },
    );
  }
  const supabase = getSupabase();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user)
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401, headers: JSONH },
    );

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "JSON inválido" },
      { status: 400, headers: JSONH },
    );
  }

  // Normaliza required_at si viene como ISO (YYYY-MM-DDTHH:mm:ssZ)
  if (
    body &&
    typeof (body as Record<string, unknown>).required_at === "string"
  ) {
    const s = (body as Record<string, string>).required_at;
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) (body as Record<string, string>).required_at = m[1];
  }

  // Compat: si viene 'subcategory' como string y no hay 'subcategories', promuévelo
  try {
    const b = body as Record<string, unknown>;
    const single = typeof b?.subcategory === "string" ? (b.subcategory as string).trim() : "";
    const arr = Array.isArray(b?.subcategories) ? (b.subcategories as unknown[]) : [];
    if (single && arr.length === 0) {
      (b as Record<string, unknown>).subcategories = [single];
      delete (b as Record<string, unknown>).subcategory;
    }
  } catch {
    /* no-op */
  }

  const parsed = RequestCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validación", details: parsed.error.flatten() },
      { status: 422, headers: JSONH },
    );
  }

  const payload = parsed.data;
  const insert: Record<string, unknown> = {
    title: payload.title,
    city: payload.city,
    created_by: user.id, // RLS exige que sea = auth.uid()
  };
  if (payload.description) insert.description = payload.description;
  if (payload.category) insert.category = payload.category;
  // Persist subcategories and attachments as JSON if provided
  if (
    Array.isArray(payload.subcategories) &&
    payload.subcategories.length > 0
  ) {
    insert.subcategories = payload.subcategories.map((s) =>
      typeof s === "string" ? { name: s } : s,
    );
  }
  if (typeof payload.budget === "number") insert.budget = payload.budget;
  if (payload.required_at) insert.required_at = payload.required_at;
  if (Array.isArray(payload.attachments) && payload.attachments.length > 0) {
    insert.attachments = payload.attachments;
  }

  const attemptInsert: Record<string, unknown> = insert;
  const resIns = await supabase
    .from("requests")
    .insert(attemptInsert)
    .select("*")
    .single();
  let { data } = resIns;
  const { error } = resIns;
  if (error) {
    const msg = (error.message || "").toLowerCase();
    const isRls = /row-level|rls|permission|not allowed/.test(msg);
    if (isRls) {
      try {
        const admin = getAdminSupabase();
        const r = await admin
          .from("requests")
          .insert(attemptInsert)
          .select("*")
          .single();
        if (r.error) {
          return NextResponse.json(
            { error: r.error.message },
            { status: 400, headers: JSONH },
          );
        }
        data = r.data as typeof data;
      } catch (e) {
        const detail = e instanceof Error ? e.message : "FAILED";
        return NextResponse.json(
          { error: "insert_failed", detail },
          { status: 400, headers: JSONH },
        );
      }
    } else {
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: JSONH },
      );
    }
  }

  return NextResponse.json({ ok: true, data }, { status: 201, headers: JSONH });
}
