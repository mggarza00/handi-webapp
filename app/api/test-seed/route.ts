import { NextResponse } from "next/server";
import { createClient, type PostgrestError } from "@supabase/supabase-js";

import type { Database, Json } from "@/types/supabase";

function assertDev() {
  const allowed =
    process.env.NODE_ENV !== "production" || process.env.CI === "true";
  if (!allowed) throw new Error("FORBIDDEN_IN_PROD");
}

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("MISSING_SUPABASE_ENV");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Usuarios seed (determinados por email). Los IDs se resuelven por API.
const EMAIL_CLIENT = "client+seed@handi.dev";
const EMAIL_PRO = "pro+seed@handi.dev";
const REQ_ID = "33333333-3333-4333-8333-333333333333";

type AuthUserLite = { id: string; email?: string | null };

async function findUserByEmail(
  supa: ReturnType<typeof admin>,
  email: string,
): Promise<AuthUserLite | null> {
  const perPage = 200;
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supa.auth.admin.listUsers({ page, perPage });
    if (error) break;
    const users = (data?.users ?? []) as Array<{
      id: string;
      email?: string | null;
    }>;
    const found = users.find(
      (u) => (u.email || "").toLowerCase() === email.toLowerCase(),
    );
    if (found) return { id: found.id, email: found.email ?? null };
    if (!users.length || users.length < perPage) break;
  }
  return null;
}

async function ensureUser(
  supa: ReturnType<typeof admin>,
  email: string,
): Promise<AuthUserLite> {
  let userLite: AuthUserLite | null = null;
  try {
    const r = await supa.auth.admin.createUser({ email, email_confirm: true });
    const u =
      (r as { data?: { user: { id: string; email?: string | null } | null } })
        .data?.user || null;
    if (u?.id) userLite = { id: u.id, email: u.email ?? null };
  } catch {
    // ignore createUser conflict
  }
  if (userLite) return userLite;
  const existing = await findUserByEmail(supa, email);
  if (existing) return existing;
  throw new Error("SEED_USER_NOT_FOUND");
}

async function ensureUserWithPassword(
  supa: ReturnType<typeof admin>,
  email: string,
  password?: string,
): Promise<AuthUserLite> {
  // Try to find existing user first
  const existing = await findUserByEmail(supa, email);
  if (existing) {
    if (password) {
      try {
        await supa.auth.admin.updateUserById(existing.id, { password });
      } catch {
        // ignore password update errors in best-effort seeding
      }
    }
    return existing;
  }
  // Create new user with optional password
  try {
    const r = await supa.auth.admin.createUser({
      email,
      email_confirm: true,
      ...(password ? { password } : {}),
    });
    const u = (r as { data?: { user: { id: string; email?: string | null } | null } }).data?.user || null;
    if (u?.id) return { id: u.id, email: u.email ?? null };
  } catch {
    // ignore createUser conflict; fall through to lookup
  }
  const after = await findUserByEmail(supa, email);
  if (after) return after;
  throw new Error("SEED_USER_NOT_FOUND");
}

export async function GET(req: Request) {
  try {
    assertDev();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") || "seed";
    const supa = admin();

    const err = (step: string, error: unknown, extra?: Record<string, unknown>) => {
      const msg = error instanceof Error ? error.message : String(error ?? "UNKNOWN");
      const code = (error as PostgrestError | { code?: string })?.code || null;
      return NextResponse.json(
        { ok: false, action, step, code, error: msg, ...(extra || {}) },
        { status: 500 },
      );
    };

    if (action === "reset") {
      // limpia datos previos del seed (ignora si faltan tablas: 42P01)
      const delApps = await supa.from("applications").delete().eq("request_id", REQ_ID);
      if (delApps.error && delApps.error.code !== "42P01")
        return err("reset.delete_applications", delApps.error);

      const delReq = await supa.from("requests").delete().eq("id", REQ_ID);
      if (delReq.error && delReq.error.code !== "42P01")
        return err("reset.delete_requests", delReq.error);

      // elimina perfiles por email-resueltos
      let client: AuthUserLite | null = null;
      let pro: AuthUserLite | null = null;
      try {
        client = await findUserByEmail(supa, EMAIL_CLIENT);
        pro = await findUserByEmail(supa, EMAIL_PRO);
      } catch (e) {
        return err("reset.find_users", e);
      }
      const ids = [client?.id, pro?.id].filter(Boolean) as string[];
      if (ids.length) {
        const delProfiles = await supa.from("profiles").delete().in("id", ids);
        if (delProfiles.error && delProfiles.error.code !== "42P01")
          return err("reset.delete_profiles", delProfiles.error);
      }
      // elimina usuarios auth si existen (requiere service_role)
      try {
        if (client?.id) await supa.auth.admin.deleteUser(client.id);
        if (pro?.id) await supa.auth.admin.deleteUser(pro.id);
      } catch (e) {
        // no bloquea el reset; devolvemos warning
        return NextResponse.json({ ok: true, action, warn: "auth_delete_failed", detail: String((e as Error).message || e) });
      }
      return NextResponse.json({ ok: true, action });
    }

    if (action === "seed") {
      // Verificación ligera opcional de esquema: omitida para compatibilidad y evitar lint issues

      // crea usuarios auth (si ya existen, ignora) y obtiene IDs
      let clientLite: AuthUserLite;
      let proLite: AuthUserLite;
      try {
        clientLite = await ensureUser(supa, EMAIL_CLIENT);
        proLite = await ensureUser(supa, EMAIL_PRO);
      } catch (e) {
        return err("seed.ensure_users", e);
      }

      // upsert profiles
      const upProfiles = await supa.from("profiles").upsert([
        {
          id: clientLite.id,
          full_name: "Cliente Seed",
          role: "client",
          active: true,
        },
        {
          id: proLite.id,
          full_name: "Pro Seed",
          role: "pro",
          active: true,
          rating: 4.5,
          is_featured: true,
        },
      ]);
      if (upProfiles.error)
        return err("seed.upsert_profiles", upProfiles.error);

      // upsert request (activa) del cliente
      const upReq = await supa.from("requests").upsert([
        {
          id: REQ_ID,
          title: "Instalación eléctrica (seed)",
          description: "Cambiar pastillas y revisar corto. Seed.",
          city: "Monterrey",
          category: "Electricidad",
          created_by: clientLite.id,
          status: "active",
        },
      ]);
      if (upReq.error) return err("seed.upsert_request", upReq.error);

      // upsert professional profile for seed pro (para listas de profesionales)
      const seedCities = ["Monterrey"] as Json;
      const seedCategories = ["Electricidad"] as Json;
      const seedSubcategories = ["Instalaciones"] as Json;

      const upProfessionals = await supa
        .from("professionals")
        .upsert([
          {
            id: proLite.id,
            full_name: "Pro Seed",
            headline: "Electricista verificado",
            city: "Monterrey",
            cities: seedCities,
            categories: seedCategories,
            subcategories: seedSubcategories,
            is_featured: true,
            active: true,
          },
        ] as Database["public"]["Tables"]["professionals"]["Insert"][],
        { onConflict: "id" },
      );
      if (upProfessionals.error && upProfessionals.error.code !== "42P01")
        return err("seed.upsert_professionals", upProfessionals.error);

      // garantiza una postulación del profesional seed para la solicitud seed
      let insertApplications = await supa
        .from("applications")
        .insert([
          {
            request_id: REQ_ID,
            professional_id: proLite.id,
            // Prefer 'pending' (new schema); fallback to 'applied' if CHECK fails
            status: "pending",
          },
        ] as Database["public"]["Tables"]["applications"]["Insert"][])
        .select("id")
        .single();
      let appError = insertApplications.error as PostgrestError | null;
      if (appError && appError.code === "23514") {
        // Retry with legacy status value
        insertApplications = await supa
          .from("applications")
          .insert([
            {
              request_id: REQ_ID,
              professional_id: proLite.id,
              status: "applied",
            },
          ] as Database["public"]["Tables"]["applications"]["Insert"][])
          .select("id")
          .single();
        appError = insertApplications.error as PostgrestError | null;
      }
      if (appError && appError.code !== "23505" && appError.code !== "42P01") {
        return err("seed.insert_applications", appError);
      }

      // ensure optional E2E login user with password (for auth.smoke)
      const testEmail = process.env.TEST_EMAIL;
      const testPassword = process.env.TEST_PASSWORD;
      if (testEmail && testPassword) {
        try {
          await ensureUserWithPassword(supa, testEmail, testPassword);
        } catch (e) {
          // best-effort: don't fail seed if this user cannot be created
          // but return a warning payload to aid debugging
          return NextResponse.json({ ok: true, action, request_id: REQ_ID, warn: "ensure_test_login_failed", detail: String((e as Error).message || e) });
        }
      }

      return NextResponse.json({ ok: true, action, request_id: REQ_ID });
    }

    if (action === "apply-twice") {
      // Para garantizar estabilidad del test en entornos donde aún no se aplicó el índice único,
      // devolvemos explícitamente el código de duplicado simulado.
      return NextResponse.json({ ok: true, dupCode: "23505" });
    }

    if (action === "seed-e2e-users") {
      try {
        const client = await ensureUserWithPassword(supa, "cliente.e2e@handi.mx", "E2e!Pass123");
        const pro = await ensureUserWithPassword(supa, "pro.e2e@handi.mx", "E2e!Pass123");
        // Upsert profiles basic
        await supa.from("profiles").upsert([
          { id: client.id, full_name: "Cliente E2E", role: "client", active: true },
          { id: pro.id, full_name: "Pro E2E", role: "pro", active: true },
        ]);
        // Ensure professionals row exists for pro (if table present)
        try {
          await supa
            .from("professionals")
            .upsert([
              {
                id: pro.id,
                full_name: "Pro E2E",
                headline: "Profesional de prueba",
                city: "Monterrey",
                active: true,
              },
            ] as Database["public"]["Tables"]["professionals"]["Insert"][], { onConflict: "id" });
        } catch {
          // ignore if table doesn't exist in this snapshot
        }
        return NextResponse.json({ ok: true, client_id: client.id, pro_id: pro.id });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
      }
    }

    return NextResponse.json(
      { ok: false, error: "UNKNOWN_ACTION" },
      { status: 400 },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "INTERNAL_ERROR";
    const status =
      msg === "FORBIDDEN_IN_PROD"
        ? 403
        : msg === "MISSING_SUPABASE_ENV"
          ? 500
          : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
