import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import getRouteClient from "@/lib/supabase/route-client";
import { env } from "@/lib/env";
import type { Database } from "@/types/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const typeParam = (url.searchParams.get("type") || "").toLowerCase();
  const rawNext = url.searchParams.get("next") || "/";
  const next = rawNext.startsWith("/") ? rawNext : "/";
  const toast = url.searchParams.get("toast");
  const nextUrl = new URL(next, env.appUrl);
  if (toast && !nextUrl.searchParams.has("toast")) {
    nextUrl.searchParams.set("toast", toast);
  }
  // Preparar una respuesta donde se apliquen cookies (mirroring en redirect)
  const supabase = getRouteClient();

  try {
    if (code) {
      await supabase.auth.exchangeCodeForSession(code);
    } else if (tokenHash) {
      const knownTypes = new Set(["recovery", "invite", "signup", "magiclink"]);
      if (typeParam && !knownTypes.has(typeParam)) {
        console.warn("[auth/callback] unknown email type:", typeParam);
      }
      const emailType: "magiclink" | "recovery" | "invite" | "signup" =
        typeParam === "recovery"
          ? "recovery"
          : typeParam === "invite"
            ? "invite"
            : typeParam === "signup"
              ? "signup"
              : "magiclink";
      await supabase.auth.verifyOtp({ type: emailType, token_hash: tokenHash });
    } else {
      throw new Error("missing_oauth_params");
    }

    const role = await ensureProfile(supabase);
    if (!role) {
      // Skip onboarding for pro-apply and request creation intents; role approval is enforced elsewhere.
      if (
        nextUrl.pathname.startsWith("/pro-apply") ||
        nextUrl.pathname.startsWith("/requests/new")
      ) {
        return NextResponse.redirect(nextUrl, { status: 302 });
      }
      const onboardingUrl = new URL("/onboarding/elige-rol", env.appUrl);
      onboardingUrl.searchParams.set(
        "next",
        `${nextUrl.pathname}${nextUrl.search}`,
      );
      if (toast) onboardingUrl.searchParams.set("toast", toast);
      return NextResponse.redirect(onboardingUrl, { status: 302 });
    }
  } catch (err) {
    const anyErr = err as unknown as {
      status?: number;
      code?: string;
      message?: string;
    };
    const status =
      typeof anyErr?.status === "number" ? anyErr.status : undefined;
    const code = typeof anyErr?.code === "string" ? anyErr.code : undefined;
    const message =
      anyErr?.message ||
      (err instanceof Error ? err.message : "oauth_exchange_failed");
    // Log once on server
    console.error("[auth/callback] OAuth exchange error:", {
      status,
      code,
      message,
    });
    const redirectUrl = new URL("/auth/sign-in", env.appUrl);
    // Preserve details so UI can show a friendlier message
    if (status) redirectUrl.searchParams.set("status", String(status));
    if (code) redirectUrl.searchParams.set("code", code);
    redirectUrl.searchParams.set("error", message);
    return NextResponse.redirect(redirectUrl, { status: 302 });
  }

  return NextResponse.redirect(nextUrl, { status: 302 });
}

async function ensureProfile(
  supabase: SupabaseClient<Database>,
): Promise<"client" | "pro" | "admin" | null> {
  const { data } = await supabase.auth.getUser();
  const user = data.user ?? null;
  if (!user) return null;

  type ProfileTable = Database["public"]["Tables"]["profiles"];
  type ProfileInsert = ProfileTable["Insert"];
  type ProfileUpdate = ProfileTable["Update"];

  const profilesTable = supabase.from("profiles");
  type LooseProfilesTable = {
    select: typeof profilesTable.select;
    insert: (values: ProfileInsert) => ReturnType<typeof profilesTable.insert>;
    update: (values: ProfileUpdate) => ReturnType<typeof profilesTable.update>;
  };
  const typedProfilesTable = profilesTable as unknown as LooseProfilesTable;

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const fullName =
    typeof metadata.full_name === "string" ? metadata.full_name : null;
  const avatarUrl =
    typeof metadata.avatar_url === "string" ? metadata.avatar_url : null;
  const email = typeof user.email === "string" ? user.email : null;

  const { data: existing, error } = await typedProfilesTable
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle<ProfileTable["Row"]>();

  if (error) {
    console.error("[auth/callback] profile lookup failed", error.message);
    return null;
  }

  if (!existing) {
    const payload: ProfileInsert = {
      id: user.id,
      full_name: fullName,
      avatar_url: avatarUrl,
      email,
    };
    const { data: inserted } = await typedProfilesTable
      .insert(payload)
      .select("role")
      .maybeSingle();
    return (inserted?.role as "client" | "pro" | "admin" | null) ?? null;
  }

  const updatePayload: ProfileUpdate = {
    full_name: fullName,
    avatar_url: avatarUrl,
    email,
  };

  await typedProfilesTable.update(updatePayload).eq("id", user.id);

  return (existing.role as "client" | "pro" | "admin" | null) ?? null;
}
