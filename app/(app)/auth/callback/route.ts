import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import type { Database } from "@/types/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const typeParam = (url.searchParams.get("type") || "").toLowerCase();
  const next = url.searchParams.get("next") || "/";

  const supabase = createRouteHandlerClient<Database>({ cookies });

  try {
    if (code) {
      await supabase.auth.exchangeCodeForSession(code);
    } else if (tokenHash) {
      const emailType:
        | "magiclink"
        | "recovery"
        | "invite" =
        typeParam === "recovery"
          ? "recovery"
          : typeParam === "invite"
            ? "invite"
            : "magiclink";
      await supabase.auth.verifyOtp({ type: emailType, token_hash: tokenHash });
    } else {
      throw new Error("missing_oauth_params");
    }

    await ensureProfile(supabase);
  } catch (err) {
    const message = err instanceof Error ? err.message : "oauth_exchange_failed";
    console.error("[auth/callback]", message);
    const redirectUrl = new URL("/auth/sign-in", env.appUrl);
    redirectUrl.searchParams.set("error", message);
    return NextResponse.redirect(redirectUrl, { status: 302 });
  }

  return NextResponse.redirect(new URL(next, env.appUrl), { status: 302 });
}

async function ensureProfile(supabase: SupabaseClient<Database>) {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return;

  type ProfileTable = Database["public"]["Tables"]["profiles"];
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const fullName = (metadata.full_name as string | undefined) ?? null;
  const avatarUrl = (metadata.avatar_url as string | undefined) ?? null;

  const { data: existing, error } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[auth/callback] profile lookup failed", error.message);
    return;
  }

  if (!existing) {
    await supabase
      .from("profiles")
      .insert({
        id: user.id,
        full_name: fullName,
        avatar_url: avatarUrl,
        role: "client",
      } satisfies ProfileTable["Insert"])
      .select("id")
      .maybeSingle();
    return;
  }

  const setClientRole = existing.role == null;
  await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      avatar_url: avatarUrl,
      ...(setClientRole ? { role: "client" as const } : {}),
    } satisfies ProfileTable["Update"])
    .eq("id", user.id)
    .select("id")
    .maybeSingle();
}
