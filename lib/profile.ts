import getServerClient from "@/lib/supabase/server-client";
import { buildGreetingText, inferGreetingPreferenceFromName } from "@/lib/greeting";
import type { Database } from "@/types/supabase";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"] & {
  greeting_preference?: "bienvenido" | "bienvenida" | "neutral" | null;
  first_name?: string | null;
  full_name?: string | null;
};

export function extractFirstName(name: string): string {
  return (name ?? "").trim().split(/\s+/)[0] || "";
}

export async function ensureGreetingPreferenceForProfile(
  profile: Profile,
): Promise<"bienvenido" | "bienvenida" | "neutral"> {
  const existingPref =
    (profile as { greeting_preference?: "bienvenido" | "bienvenida" | "neutral" | null })
      .greeting_preference;
  if (existingPref) {
    return existingPref;
  }

  const firstName = extractFirstName(profile.first_name || profile.full_name || "");
  const pref = inferGreetingPreferenceFromName(firstName);

  try {
    const supabase = getServerClient();
    const profileId = (profile as { id?: string | null }).id;
    if (profileId) {
      await supabase.from("profiles").update({ greeting_preference: pref }).eq("id", profileId);
    }
  } catch {
    // Persist failure should not block greeting
  }

  return pref;
}

export function buildGreetingForProfile(
  profile: Profile,
): string {
  const firstName = extractFirstName(profile.first_name || profile.full_name || "");
  const pref = (profile.greeting_preference ||
    inferGreetingPreferenceFromName(firstName)) as "bienvenido" | "bienvenida" | "neutral";
  return buildGreetingText(pref, firstName);
}
