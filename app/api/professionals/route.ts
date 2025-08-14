// app/api/professionals/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer, getUserOrThrow } from "@/lib/supabase-server";

const upsertSchema = z.object({
  headline: z.string().min(3),
  skills: z.array(z.string()).default([]),
});

export async function POST(req: Request) {
  try {
    const user = await getUserOrThrow();
    const body = await req.json();
    const parsed = upsertSchema.parse(body);

    const supabase = supabaseServer();

    // Asegura perfil
    await supabase
      .from("profiles")
      .upsert({ id: user.id }, { onConflict: "id", ignoreDuplicates: false });

    // 1–a–1 por profile_id
    const { data: existing } = await supabase
      .from("professionals")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();

    let res;
    if (existing?.id) {
      res = await supabase
        .from("professionals")
        .update({
          headline: parsed.headline,
          skills: parsed.skills,
        })
        .eq("id", existing.id)
        .select()
        .single();
    } else {
      res = await supabase
        .from("professionals")
        .insert({
          profile_id: user.id,
          headline: parsed.headline,
          skills: parsed.skills,
        })
        .select()
        .single();
    }

    if (res.error) return NextResponse.json({ ok: false, error: res.error.message }, { status: 400 });
    return NextResponse.json({ ok: true, data: res.data });
  } catch (e: any) {
    const status = e?.status ?? 500;
    return NextResponse.json({ ok: false, error: e?.message ?? "INTERNAL_ERROR" }, { status });
  }
}
