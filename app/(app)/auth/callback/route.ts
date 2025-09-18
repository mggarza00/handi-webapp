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

  const supabase = createRouteHandlerClient<Database, "public">({ cookies });

  try {
    if (code) {
      await supabase.auth.exchangeCodeForSession(code);
    } else if (tokenHash) {
      const emailType: "magiclink" | "recovery" | "invite" =
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

async function ensureProfile(supabase: SupabaseClient<Database, "public">) {
  const { data } = await supabase.auth.getUser();
  const user = data.user ?? null;
  if (!user) return;

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
  const fullName = typeof metadata.full_name === "string" ? metadata.full_name : null;
  const avatarUrl = typeof metadata.avatar_url === "string" ? metadata.avatar_url : null;

  const { data: existing, error } = await typedProfilesTable
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle<ProfileTable["Row"]>();

  if (error) {
    console.error("[auth/callback] profile lookup failed", error.message);
    return;
  }

  if (!existing) {
    const payload: ProfileInsert = {
      id: user.id,
      full_name: fullName,
      avatar_url: avatarUrl,
      role: "client",
    };
    await typedProfilesTable.insert(payload);
    return;
  }

  const updatePayload: ProfileUpdate = {
    full_name: fullName,
    avatar_url: avatarUrl,
  };

  if (existing.role == null) {
    updatePayload.role = "client";
  }

  await typedProfilesTable
    .update(updatePayload)
    .eq("id", user.id);
}

