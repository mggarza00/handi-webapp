import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function assertDev() {
  const allowed = process.env.NODE_ENV !== "production" || process.env.CI === "true";
  if (!allowed) throw new Error("FORBIDDEN_IN_PROD");
}

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("MISSING_SUPABASE_ENV");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// Usuarios seed (determinados por email). Los IDs se resuelven por API.
const EMAIL_CLIENT = "client+seed@handee.dev";
const EMAIL_PRO = "pro+seed@handee.dev";
const REQ_ID      = "33333333-3333-4333-8333-333333333333";

type AuthUserLite = { id: string; email?: string | null };

async function findUserByEmail(supa: ReturnType<typeof admin>, email: string): Promise<AuthUserLite | null> {
  const perPage = 200;
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supa.auth.admin.listUsers({ page, perPage });
    if (error) break;
    const users = (data?.users ?? []) as Array<{ id: string; email?: string | null }>;
    const found = users.find((u) => (u.email || "").toLowerCase() === email.toLowerCase());
    if (found) return { id: found.id, email: found.email ?? null };
    if (!users.length || users.length < perPage) break;
  }
  return null;
}

async function ensureUser(supa: ReturnType<typeof admin>, email: string): Promise<AuthUserLite> {
  let userLite: AuthUserLite | null = null;
  try {
    const r = await supa.auth.admin.createUser({ email, email_confirm: true });
    const u = (r as { data?: { user: { id: string; email?: string | null } | null } }).data?.user || null;
    if (u?.id) userLite = { id: u.id, email: u.email ?? null };
  } catch {
    // ignore createUser conflict
  }
  if (userLite) return userLite;
  const existing = await findUserByEmail(supa, email);
  if (existing) return existing;
  throw new Error("SEED_USER_NOT_FOUND");
}

export async function GET(req: Request) {
  try {
    assertDev();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") || "seed";
    const supa = admin();

    if (action === "reset") {
      // limpia datos previos del seed
      await supa.from("applications").delete().eq("request_id", REQ_ID);
      await supa.from("requests").delete().eq("id", REQ_ID);
      // elimina perfiles por email-resueltos
      const client = await findUserByEmail(supa, EMAIL_CLIENT);
      const pro = await findUserByEmail(supa, EMAIL_PRO);
      const ids = [client?.id, pro?.id].filter(Boolean) as string[];
      if (ids.length) await supa.from("profiles").delete().in("id", ids);
      // elimina usuarios auth si existen (requiere service_role)
      if (client?.id) await supa.auth.admin.deleteUser(client.id).catch(() => { /* ignore */ });
      if (pro?.id) await supa.auth.admin.deleteUser(pro.id).catch(() => { /* ignore */ });
      return NextResponse.json({ ok: true, action });
    }

    if (action === "seed") {
      // crea usuarios auth (si ya existen, ignora) y obtiene IDs
      const client = await ensureUser(supa, EMAIL_CLIENT);
      const pro = await ensureUser(supa, EMAIL_PRO);

      // upsert profiles
      await supa.from("profiles").upsert([
        { id: client.id, full_name: "Cliente Seed", role: "client", active: true },
        { id: pro.id,    full_name: "Pro Seed",     role: "pro",    active: true, rating: 4.5, is_featured: true }
      ]);

      // upsert request (activa) del cliente
      await supa.from("requests").upsert([{
        id: REQ_ID,
        title: "Instalación eléctrica (seed)",
        description: "Cambiar pastillas y revisar corto. Seed.",
        city: "Monterrey",
        category: "Electricidad",
        created_by: client.id,
        status: "active"
      }]);

      return NextResponse.json({ ok: true, action, request_id: REQ_ID });
    }

    if (action === "apply-twice") {
      const pro = await ensureUser(supa, EMAIL_PRO);
      // intenta crear 2 postulaciones del mismo pro a la misma request para probar unicidad
      const first = await supa.from("applications").insert({
        request_id: REQ_ID,
        professional_id: pro.id,
        note: "Puedo apoyar con este trabajo (seed).",
        status: "applied"
      });
      // segundo intento — debe violar índice único
      const second = await supa.from("applications").insert({
        request_id: REQ_ID,
        professional_id: pro.id,
        note: "Duplicado",
        status: "applied"
      });

      const firstOk = !first.error;
      const dupCode = second.error?.code || null; // debería ser '23505'
      const isUniqueViolated = dupCode === "23505";
      const http = isUniqueViolated ? 200 : 500;
      return NextResponse.json({ ok: firstOk && isUniqueViolated, dupCode }, { status: http });
    }

    return NextResponse.json({ ok: false, error: "UNKNOWN_ACTION" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "INTERNAL_ERROR";
    const status = msg === "FORBIDDEN_IN_PROD" ? 403 : (msg === "MISSING_SUPABASE_ENV" ? 500 : 500);
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
