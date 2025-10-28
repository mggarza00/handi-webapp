import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import createClient from "@/utils/supabase/server";

import { RequestCreateSchema, RequestListQuerySchema } from "@/lib/validators/requests";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { createBearerClient } from "@/lib/supabase";
import { getDevUserFromHeader } from "@/lib/auth-route";
import type { Database } from "@/types/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

function getSupabase() {
  return createClient();
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
  if (status) {
    // Permite CSV de estatus (p. ej. "active,in_process") y compat con sinónimos
    const raw = String(status)
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const set = new Set<string>();
    for (const s of raw) {
      if (s === "cancelled" || s === "canceled") {
        set.add("cancelled");
        set.add("canceled");
      } else if (s === "completed" || s === "finished") {
        set.add("completed");
        set.add("finished");
      } else {
        set.add(s);
      }
    }
    const values = Array.from(set);
    if (values.length === 1) {
      query = query.eq("status", values[0]);
    } else if (values.length > 1) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query = (query as any).in("status", values);
    }
  } else if (!mine) query = query.eq("status", "active"); // default: solo activas si no se piden propias
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
  // Privacidad: no exponer address_* en listados públicos (solo incluir si mine=1)
  const safe = Array.isArray(data)
    ? data.map((row: any) => {
        if (!mine) {
          const { address_line, address_place_id, address_lat, address_lng, address_postcode, address_state, address_country, address_context, ...rest } = row || {};
          return rest;
        }
        return row;
      })
    : data;

  return NextResponse.json({ ok: true, data: safe, nextCursor }, { status: 200, headers: JSONH });
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
  // Try dev header override first (x-user-id), then regular cookie auth
  let actingUserId: string | null = null;
  let preferAdminInsert = false;
  try {
    const dev = await getDevUserFromHeader(req);
    if (dev?.user?.id) {
      actingUserId = dev.user.id;
      preferAdminInsert = true;
    }
  } catch {
    /* ignore */
  }

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (!actingUserId) actingUserId = user?.id ?? null;
  
  // E2E fallback: allow cookie-based test session to create requests via admin client
  if ((!actingUserId && authErr) || (!actingUserId && !user)) {
    try {
      const cookieStore = cookies();
      const raw = cookieStore.get("e2e_session")?.value || "";
      if (raw) {
        const decoded = decodeURIComponent(raw);
        const email = decoded.split(":")[0] || "";
        if (email) {
          const admin = getAdminSupabase();
          // Find or create user by email (best-effort)
          let foundId: string | null = null;
          try {
            const perPage = 200;
            for (let page = 1; page <= 10 && !foundId; page++) {
              const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
              if (error) break;
              const users = (data?.users ?? []) as Array<{ id: string; email?: string | null }>;
              const match = users.find((u) => (u.email || "").toLowerCase() === email.toLowerCase());
              if (match) foundId = match.id;
              if (!users.length || users.length < perPage) break;
            }
            if (!foundId) {
              const r = await admin.auth.admin.createUser({ email, email_confirm: true });
              const u = (r as { data?: { user: { id: string; email?: string | null } | null } }).data?.user || null;
              if (u?.id) foundId = u.id;
            }
          } catch {
            /* ignore */
          }
          if (foundId) {
            actingUserId = foundId;
            preferAdminInsert = true;
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (!actingUserId) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401, headers: JSONH },
    );
  }

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
  // Normaliza el título: primera letra en mayúscula (resto se mantiene), y recorta espacios laterales
  const normalizedTitle = (() => {
    const t = (payload.title || "").trim();
    if (!t) return t;
    return t.charAt(0).toUpperCase() + t.slice(1);
  })();
  const insert: Record<string, unknown> = {
    title: normalizedTitle,
    city: payload.city,
    created_by: actingUserId, // RLS exige que sea = auth.uid() (or admin bypass)
  };
  if (payload.description) insert.description = payload.description;
  if (payload.category) insert.category = payload.category;
  // conditions: aceptar string o array; normalizar y deduplicar
  try {
    const cond = (payload as { conditions?: unknown }).conditions;
    let arr: string[] = [];
    if (typeof cond === "string") {
      arr = cond
        .split(",")
        .map((s) => s.replace(/\s+/g, " ").trim())
        .filter((s) => s.length > 0);
    } else if (Array.isArray(cond)) {
      arr = cond
        .map((s) => (typeof s === "string" ? s : ""))
        .map((s) => s.replace(/\s+/g, " ").trim())
        .filter((s) => s.length >= 2 && s.length <= 40);
    }
    if (arr.length > 0) {
      // Dedup sin perder orden; máx 10; longitud total 240
      const seen = new Set<string>();
      const out: string[] = [];
      for (const s of arr) {
        if (!seen.has(s)) {
          seen.add(s);
          out.push(s);
          if (out.length >= 10) break;
        }
      }
      let joined = out.join(", ");
      if (joined.length > 240) {
        // recorta quitando del final
        while (joined.length > 240 && out.length > 0) {
          out.pop();
          joined = out.join(", ");
        }
      }
      if (joined) insert.conditions = joined;
    }
  } catch {
    /* ignore conditions */
  }
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
  // Meta de dirección extra (opcionales)
  try {
    const addr = payload as Record<string, unknown>;
    if (typeof addr.address_postcode === 'string' && (addr.address_postcode as string).trim()) (insert as Record<string, unknown>).address_postcode = addr.address_postcode;
    if (typeof addr.address_state === 'string' && (addr.address_state as string).trim()) (insert as Record<string, unknown>).address_state = addr.address_state;
    if (typeof addr.address_country === 'string' && (addr.address_country as string).trim()) (insert as Record<string, unknown>).address_country = addr.address_country;
    if (typeof addr.address_context !== 'undefined') (insert as Record<string, unknown>).address_context = addr.address_context;
  } catch { /* ignore */ }
  // Dirección opcional
  try {
    const addr = (payload as Record<string, unknown>);
    const address_line = typeof addr.address_line === "string" ? addr.address_line.trim() : "";
    const address_place_id = typeof addr.address_place_id === "string" ? addr.address_place_id.trim() : "";
    const address_lat = typeof addr.address_lat === "number" ? addr.address_lat : null;
    const address_lng = typeof addr.address_lng === "number" ? addr.address_lng : null;
    if (address_line) (insert as Record<string, unknown>).address_line = address_line;
    if (address_place_id) (insert as Record<string, unknown>).address_place_id = address_place_id;
    if (address_lat != null) (insert as Record<string, unknown>).address_lat = address_lat;
    if (address_lng != null) (insert as Record<string, unknown>).address_lng = address_lng;
  } catch { /* ignore */ }

  const attemptInsert: Record<string, unknown> = insert;
  let data: unknown;
  if (preferAdminInsert) {
    try {
      const admin = getAdminSupabase();
      const r = await admin.from("requests").insert(attemptInsert).select("*").single();
      if (r.error) {
        return NextResponse.json(
          { error: r.error.message },
          { status: 400, headers: JSONH },
        );
      }
      data = r.data;
    } catch (e) {
      const detail = e instanceof Error ? e.message : "FAILED";
      return NextResponse.json(
        { error: "insert_failed", detail },
        { status: 400, headers: JSONH },
      );
    }
  } else {
    const resIns = await supabase
      .from("requests")
      .insert(attemptInsert as any)
      .select("*")
      .single();
    data = resIns.data;
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
  }

  // Best-effort: guarda/actualiza dirección usada por el usuario (RPC, incrementa times_used y refresca last_used_at)
  try {
    const d = (data || {}) as Record<string, unknown>;
    const address_line = typeof d.address_line === "string" ? d.address_line : null;
    const address_place_id = typeof d.address_place_id === "string" ? d.address_place_id : null;
    const lat = typeof d.address_lat === "number" ? d.address_lat : null;
    const lng = typeof d.address_lng === "number" ? d.address_lng : null;
    if (actingUserId && (address_line || address_place_id)) {
      // Use cookie-auth client so auth.uid() inside the function resolves correctly
      const rpc = getSupabase() as any;
      await rpc.rpc("upsert_user_address", {
        address_line: address_line ?? "",
        address_place_id: address_place_id ?? null,
        lat: lat ?? null,
        lng: lng ?? null,
        label: null,
      });
    }
  } catch { /* ignore */ }

  return NextResponse.json({ ok: true, data }, { status: 201, headers: JSONH });
}
