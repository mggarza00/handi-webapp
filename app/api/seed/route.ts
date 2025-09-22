import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
} as const;

const RowWithId = z.object({ id: z.string().uuid() });
const ArrayRowWithId = z.array(RowWithId);

async function createUser(
  baseUrl: string,
  serviceRole: string,
  email: string,
): Promise<string> {
  const res = await fetch(`${baseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ email, email_confirm: true }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`auth_admin_create_user_failed: ${res.status} ${detail}`);
  }
  const json = (await res.json()) as unknown;
  // respuesta típica: { id: "...", email: "...", ... }
  const parsed = RowWithId.safeParse(json);
  if (!parsed.success)
    throw new Error("auth_admin_create_user_invalid_response");
  return parsed.data.id;
}

async function insertOne(
  baseUrl: string,
  serviceRole: string,
  table: string,
  payload: unknown,
): Promise<string> {
  const res = await fetch(`${baseUrl}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      "Content-Type": "application/json; charset=utf-8",
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`postgrest_insert_failed:${table}:${res.status} ${detail}`);
  }
  const json = (await res.json()) as unknown;
  const parsed = ArrayRowWithId.safeParse(json);
  if (!parsed.success || parsed.data.length === 0)
    throw new Error("postgrest_insert_invalid_response");
  return parsed.data[0].id;
}

export async function POST() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!baseUrl || !serviceRole) {
      return NextResponse.json(
        {
          ok: false,
          error: "supabase_misconfigured",
          detail:
            "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.",
        },
        { status: 500, headers: JSON_HEADERS },
      );
    }

    const ts = Date.now();
    const clientEmail = `client+${ts}@handi.test`;
    const proEmail = `pro+${ts}@handi.test`;

    // 1) Usuarios (Auth Admin)
    const clientId = await createUser(baseUrl, serviceRole, clientEmail);
    const proId = await createUser(baseUrl, serviceRole, proEmail);

    // 2) Request (PostgREST)
    const requestId = await insertOne(baseUrl, serviceRole, "requests", {
      title: "Demo request (seed)",
      description: "Generada por /api/seed",
      city: "Monterrey",
      category: "general",
      created_by: clientId,
    });

    // 3) Agreement (PostgREST)
    const agreementId = await insertOne(baseUrl, serviceRole, "agreements", {
      request_id: requestId,
      professional_id: proId,
      amount: 50,
    });

    return NextResponse.json(
      {
        ok: true,
        client_user: { id: clientId, email: clientEmail },
        pro_user: { id: proId, email: proEmail },
        request: { id: requestId },
        agreement: { id: agreementId },
      },
      { status: 201, headers: JSON_HEADERS },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unexpected_error";
    return NextResponse.json(
      { ok: false, error: "seed_failed", detail: msg },
      { status: 500, headers: JSON_HEADERS },
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "method_not_allowed", hint: "usa POST /api/seed" },
    { status: 405, headers: JSON_HEADERS },
  );
}
