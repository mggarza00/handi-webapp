import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer, getUserOrThrow } from "@/lib/supabase-server";

const applySchema = z.object({
  requestId: z.string().uuid(),
  coverLetter: z.string().optional(),
  proposedBudget: z.number().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await getUserOrThrow();
    const body = await req.json();
    const parsed = applySchema.parse(body);

    const supabase = supabaseServer();

    // Buscar Professional del usuario
    const { data: prof, error: e1 } = await supabase
      .from("professionals")
      .select("id")
      .eq("profile_id", user.id)
      .single();

    if (e1 || !prof?.id) {
      return NextResponse.json({ ok: false, error: "PROFESSIONAL_NOT_FOUND" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("applications")
      .insert({
        request_id: parsed.requestId,
        professional_id: prof.id,
        cover_letter: parsed.coverLetter ?? null,
        proposed_budget: parsed.proposedBudget ?? null,
        status: "pending",
      })
      .select()
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    const status = e?.status ?? 500;
    return NextResponse.json({ ok: false, error: e?.message ?? "INTERNAL_ERROR" }, { status });
  }
}
