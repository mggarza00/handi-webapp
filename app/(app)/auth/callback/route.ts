import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
 
import type { Database } from "@/types/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const typeParam = (url.searchParams.get("type") || "").toLowerCase();
  const next = url.searchParams.get("next") || "/";
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  if (error) {
    // Redirige a sign-in con el error visible en la query
    const redirectUrl = new URL(`/auth/sign-in?error=${encodeURIComponent(error)}${errorDescription ? `&error_description=${encodeURIComponent(errorDescription)}` : ""}`, url.origin);
    return NextResponse.redirect(redirectUrl);
  }

  if (code) {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    try {
      await supabase.auth.exchangeCodeForSession(code);
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (user) {
        type UserMeta = { full_name?: string | null; avatar_url?: string | null };
        const meta = (user.user_metadata as unknown as UserMeta) || {};
        await supabase
          .from("profiles")
          .upsert({
            id: user.id,
            full_name: meta.full_name ?? null,
            avatar_url: meta.avatar_url ?? null,
            last_active_at: new Date().toISOString(),
            active: true,
          } as Database["public"]["Tables"]["profiles"]["Insert"])
          .select("id")
          .maybeSingle();
      }
    } catch (e: unknown) {
      // Log mínimo para diagnosticar (ver logs del server)
      const msg = e instanceof Error ? e.message : typeof e === "string" ? e : "unknown_error";
      console.error("[auth/callback] exchangeCodeForSession failed:", msg);
      const redirectUrl = new URL(`/auth/sign-in?error=oauth_exchange_failed`, url.origin);
      return NextResponse.redirect(redirectUrl);
    }
  }
  // Manejo de Magic Link / Email OTP (token_hash)
  else if (tokenHash) {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    // Para token_hash solo aplican tipos de email
    const emailType: "magiclink" | "recovery" | "invite" =
      typeParam === "recovery" ? "recovery" : typeParam === "invite" ? "invite" : "magiclink";
    try {
      await supabase.auth.verifyOtp({ type: emailType, token_hash: tokenHash });
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (user) {
        type UserMeta = { full_name?: string | null; avatar_url?: string | null };
        const meta = (user.user_metadata as unknown as UserMeta) || {};
        await supabase
          .from("profiles")
          .upsert({
            id: user.id,
            full_name: meta.full_name ?? null,
            avatar_url: meta.avatar_url ?? null,
            last_active_at: new Date().toISOString(),
            active: true,
          } as Database["public"]["Tables"]["profiles"]["Insert"])
          .select("id")
          .maybeSingle();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : typeof e === "string" ? e : "unknown_error";
      console.error("[auth/callback] verifyOtp failed:", msg);
      const redirectUrl = new URL(`/auth/sign-in?error=otp_verify_failed`, url.origin);
      return NextResponse.redirect(redirectUrl);
    }
  }

  const redirectTo = new URL(next.startsWith("/") ? next : "/", url.origin);
  return NextResponse.redirect(redirectTo);
}
