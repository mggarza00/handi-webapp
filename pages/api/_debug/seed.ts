import type { NextApiRequest, NextApiResponse } from "next";

type J = Record<string, unknown>;
const _JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" } as const;

async function createUser(baseUrl: string, serviceRole: string, email: string): Promise<string> {
  const res = await fetch(`${baseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ email, email_confirm: true }),
  });
  if (!res.ok) throw new Error(`auth_admin_create_user_failed:${res.status} ${await res.text()}`);
  const data = (await res.json()) as { id?: string };
  if (!data?.id) throw new Error("auth_admin_invalid_response");
  return data.id;
}

async function insertOne(baseUrl: string, serviceRole: string, table: string, payload: J): Promise<string> {
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
  if (!res.ok) throw new Error(`postgrest_insert_failed:${table}:${res.status} ${await res.text()}`);
  const arr = (await res.json()) as Array<{ id?: string }>;
  const id = arr?.[0]?.id;
  if (!id) throw new Error("postgrest_insert_invalid_response");
  return id;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed", hint: "usa POST /api/_debug/seed" });
    return;
  }
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!baseUrl || !serviceRole) {
      res.status(500).json({ ok: false, error: "supabase_misconfigured" });
      return;
    }

    const ts = Date.now();
    const clientEmail = `client+${ts}@handee.test`;
    const proEmail = `pro+${ts}@handee.test`;

    const clientId = await createUser(baseUrl, serviceRole, clientEmail);
    const proId = await createUser(baseUrl, serviceRole, proEmail);

    const requestId = await insertOne(baseUrl, serviceRole, "requests", {
      title: "Demo request (seed)",
      description: "Generada por /api/_debug/seed (pages)",
      city: "Monterrey",
      category: "general",
      created_by: clientId,
    });

    const agreementId = await insertOne(baseUrl, serviceRole, "agreements", {
      request_id: requestId,
      professional_id: proId,
      amount: 50,
    });

    res.status(201).json({
      ok: true,
      client_user: { id: clientId, email: clientEmail },
      pro_user: { id: proId, email: proEmail },
      request: { id: requestId },
      agreement: { id: agreementId },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unexpected_error";
    res.status(500).json({ ok: false, error: "seed_failed", detail: msg });
  }
}
