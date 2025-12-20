import LandingPage from "./page.client";

import { buildGreetingText, inferGreetingPreferenceFromName } from "@/lib/greeting";
import { ensureGreetingPreferenceForProfile, extractFirstName } from "@/lib/profile";
import getServerClient from "@/lib/supabase/server-client";
import type { Database } from "@/types/supabase";

type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "full_name" | "first_name" | "role" | "avatar_url"
> & {
  gender?: string | null;
  is_client_pro?: boolean | null;
  is_admin?: boolean | null;
  greeting_preference?: "bienvenido" | "bienvenida" | "neutral" | null;
};

type SavedAddress = {
  id: string;
  label: string | null;
  address_line: string;
  address_place_id: string | null;
  lat: number | null;
  lng: number | null;
  last_used_at: string | null;
  times_used?: number | null;
};

export const revalidate = 0;
export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = getServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user ?? null;

  let profile: ProfileRow | null = null;
  if (user) {
    const baseSelect =
      "id, full_name, first_name, role, avatar_url, is_client_pro, is_admin";
    const selectWithGreeting = `${baseSelect}, greeting_preference`;

    const fetchProfile = async (select: string) =>
      supabase
        .from("profiles")
        .select(`${select}, gender`)
        .eq("id", user.id)
        .maybeSingle<ProfileRow>();

    const { data, error } = await fetchProfile(selectWithGreeting);
    if (!error && data) {
      profile = data;
    } else {
      const retry = await fetchProfile(baseSelect);
      profile = retry.data ?? null;
    }
  }

  let savedAddresses: SavedAddress[] = [];
  if (user) {
    const { data } = await supabase
      .from("user_saved_addresses")
      .select("id,label,address_line,address_place_id,lat,lng,last_used_at,times_used")
      .eq("user_id", user.id)
      .order("last_used_at", { ascending: false })
      .limit(5);
    savedAddresses = (data || []) as SavedAddress[];
  }

  const fullName =
    profile?.full_name ??
    (user?.user_metadata?.full_name as string | null) ??
    user?.email ??
    null;
  const mappedRole = (() => {
    const role = (profile?.role ?? null) as null | "client" | "pro" | "admin";
    if (role === "pro" || profile?.is_client_pro) return "pro" as const;
    if (role === "admin" || profile?.is_admin) return "admin" as const;
    if (role === "client") return "client" as const;
    return null;
  })();

  const variant = !user
    ? "guest"
    : mappedRole === "pro" || mappedRole === "admin"
      ? "other"
      : "client";
  let greetingText: string | undefined;

  if (variant === "client" && user) {
    const firstName = extractFirstName(
      (profile?.first_name as string | null) ??
        (profile?.full_name as string | null) ??
        (user.user_metadata?.full_name as string | null) ??
        user.email ??
        "",
    );

    const pref = profile
      ? await ensureGreetingPreferenceForProfile(profile as ProfileRow)
      : inferGreetingPreferenceFromName(firstName);
    greetingText = buildGreetingText(pref, firstName);
  }

  return (
    <LandingPage
      variant={variant}
      greetingText={greetingText}
      fullName={fullName}
      savedAddresses={savedAddresses}
    />
  );
}
