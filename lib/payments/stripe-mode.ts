import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";
import type { StripeMode } from "@/lib/stripe";

type UserInfo = { id?: string; email?: string | null };

function parseAllowlist(
  envValue?: string | null,
  options?: { lowercase?: boolean },
): Set<string> {
  return new Set(
    (envValue || "")
      .split(",")
      .map((s) => s.trim())
      .map((value) => (options?.lowercase ? value.toLowerCase() : value))
      .filter(Boolean),
  );
}

export function getStripeAllowlist() {
  return {
    emails: parseAllowlist(process.env.STRIPE_TEST_ALLOWLIST_EMAILS, {
      lowercase: true,
    }),
    userIds: parseAllowlist(process.env.STRIPE_TEST_ALLOWLIST_USER_IDS),
  };
}

function isAllowlisted(user: UserInfo | null): boolean {
  if (!user) return false;
  const { emails, userIds } = getStripeAllowlist();
  const email = (user.email || "").toLowerCase();
  if (email && emails.has(email)) return true;
  const id = user.id || "";
  if (id && userIds.has(id)) return true;
  return false;
}

export async function resolveStripeModeForRequestUser(
  supabase: SupabaseClient<Database>,
): Promise<StripeMode> {
  if (process.env.STRIPE_DUAL_MODE_ENABLED !== "1") return "live";
  try {
    const { data } = await supabase.auth.getUser();
    const user = data?.user as UserInfo | null;
    if (!user) return "live";
    return isAllowlisted(user) ? "test" : "live";
  } catch {
    return "live";
  }
}
