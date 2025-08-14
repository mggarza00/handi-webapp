// app/auth/sign-in/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET(req: Request) {
  const supabase = supabaseServer();
  const url = new URL(req.url);
  const origin = url.origin; // http://localhost:3000 o tu dominio

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
      queryParams: {
        // prompt: "select_account",
      },
    },
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
  return NextResponse.redirect(data.url);
}
