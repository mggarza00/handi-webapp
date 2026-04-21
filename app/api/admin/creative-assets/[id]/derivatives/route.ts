import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { listCreativeAssetDerivatives } from "@/lib/creative/repository";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  try {
    const admin = getAdminSupabase();
    const items = await listCreativeAssetDerivatives(admin, params.id);

    return NextResponse.json({ ok: true, items }, { headers: JSONH });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "failed to list creative derivatives";
    return NextResponse.json(
      { ok: false, error: "internal_error", detail: message },
      { status: 500, headers: JSONH },
    );
  }
}
