import { NextResponse } from "next/server";
import { z } from "zod";

import { supabaseServer, getUserOrThrow } from "@/lib/_supabase-server";
import { getErrorMessage } from "@/lib/errors";

const BodySchema = z.object({
  application_id: z.string().uuid(),
  action: z.enum(["accept", "reject", "complete"]),
});

export async function POST(req: Request) {
  try {
    const _supabase = await supabaseServer();
    await getUserOrThrow(); // valida sesión; RLS protege
    const json = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Validation error", issues: parsed.error.issues.map(i => ({ path: i.path, message: i.message })) },
        { status: 400 },
      );
    }

    // Nota: sólo dejamos stub para compilar; implementaremos la transición real después.
    return NextResponse.json(
      { ok: false, error: "Not implemented", detail: "Transiciones de estado pendientes (accept/reject/complete)" },
      { status: 501 },
    );
  } catch (e: unknown) {
    const message = getErrorMessage(e);
    const isAuth = /auth|session|jwt/i.test(message);
    return NextResponse.json({ ok: false, error: message }, { status: isAuth ? 401 : 500 });
  }
}
