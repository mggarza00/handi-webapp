import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { createClient as createServerClientUtil } from "@/utils/supabase/server";

import type { Database } from "@/types/supabase";
import { createServerClient } from "@/lib/supabase";
import { getDevUserFromHeader } from "@/lib/auth-route";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const BodySchema = z.object({
  request_id: z.string().uuid(),
  note: z.string().max(2000).optional(),
});

async function findUserIdByE2ECookie(): Promise<string | null> {
  try {
    const jar = cookies();
    const raw = jar.get("e2e_session")?.value || "";
    if (!raw) return null;
    const [email] = decodeURIComponent(raw).split(":");
    if (!email) return null;
    const admin = createServerClient();
    // paginate to find the user
    const perPage = 200;
    for (let page = 1; page <= 10; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) break;
      const users = (data?.users ?? []) as Array<{ id: string; email?: string | null }>;
      const match = users.find((u) => (u.email || "").toLowerCase() === email.toLowerCase());
      if (match) return match.id;
      if (!users.length || users.length < perPage) break;
    }
  } catch {
    // ignore
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json"))
      return NextResponse.json(
        { ok: false, error: "UNSUPPORTED_MEDIA_TYPE" },
        { status: 415, headers: JSONH },
      );

    const body = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "VALIDATION_ERROR", detail: parsed.error.flatten() },
        { status: 422, headers: JSONH },
      );
    }
    const { request_id } = parsed.data;

    const routeClient = createServerClientUtil();
    const {
      data: { user },
    } = await routeClient.auth.getUser();

    // Resolve acting professional id
    let actingUserId: string | null = null;
    let preferAdmin = false;

    const dev = await getDevUserFromHeader(req).catch(() => null);
    if (dev?.user?.id) {
      actingUserId = dev.user.id;
      preferAdmin = true;
    }
    if (!actingUserId && user?.id) actingUserId = user.id;
    if (!actingUserId) {
      actingUserId = await findUserIdByE2ECookie();
      if (actingUserId) preferAdmin = true;
    }
    if (!actingUserId) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 401, headers: JSONH },
      );
    }

    const payload = {
      request_id,
      professional_id: actingUserId,
      // status omitted → DB default 'pending' or CHECK constraint handles
    } as Database["public"]["Tables"]["applications"]["Insert"];

    const admin = createServerClient();
    const client = preferAdmin ? admin : routeClient;

    // Try insert; handle duplicate (23505)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const up: any = await client
      .from("applications")
      .insert([payload])
      .select("id")
      .single();

    if (up.error) {
      const code = up.error.code as string | undefined;
      if (code === "23505") {
        // find existing row id
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const existing: any = await admin
          .from("applications")
          .select("id")
          .eq("request_id", request_id)
          .eq("professional_id", actingUserId)
          .maybeSingle();
        const id = existing?.data?.id ?? null;
        return NextResponse.json(
          { ok: true, id, duplicate: true },
          { status: 200, headers: JSONH },
        );
      }
      return NextResponse.json(
        { ok: false, error: up.error.message, code },
        { status: 400, headers: JSONH },
      );
    }

    return NextResponse.json(
      { ok: true, id: up.data?.id ?? null },
      { status: 201, headers: JSONH },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "INTERNAL_ERROR";
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500, headers: JSONH },
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
