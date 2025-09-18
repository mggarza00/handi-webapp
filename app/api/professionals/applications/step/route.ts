import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { z } from "zod";

import { getUserOrThrow, supabaseServer } from "@/lib/_supabase-server";
import { getErrorMessage } from "@/lib/errors";
import type { Database } from "@/types/supabase";

const BodySchema = z.object({
  application_id: z.string().uuid(),
  action: z.enum(["accept", "reject", "complete"]),
});

export async function POST(req: Request) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    await supabaseServer();
    await getUserOrThrow(supabase);
    const json = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Validation error",
          issues: parsed.error.issues.map((i) => ({
            path: i.path,
            message: i.message,
          })),
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: "Not implemented",
        detail: "Transiciones de estado pendientes (accept/reject/complete)",
      },
      { status: 501 },
    );
  } catch (e: unknown) {
    const message = getErrorMessage(e);
    const isAuth = /auth|session|jwt/i.test(message);
    return NextResponse.json(
      { ok: false, error: message },
      { status: isAuth ? 401 : 500 },
    );
  }
}
