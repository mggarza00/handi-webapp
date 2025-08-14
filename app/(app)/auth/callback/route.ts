import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  const url = new URL(request.url);
  const redirectTo = url.searchParams.get("redirect_to") ?? "/";

  return NextResponse.redirect(new URL(redirectTo, request.url));
}
