// lib/request-pro-alerts.ts
import { toNames } from "@/lib/professionals/filter";
import { createServerClient } from "@/lib/supabase";

type AlertArgs = {
  requestId: string;
  userId: string;
  requestTitle?: string | null;
  city?: string | null;
  category?: string | null;
  subcategory?: string | null;
  subcategories?: unknown;
};

function buildSubcategoryPayload(
  subcategory: string | null | undefined,
  subcategories: unknown,
): { primary: string | null; list: string[] } {
  const subs = toNames(subcategories);
  const primary = (subcategory && subcategory.trim().length ? subcategory.trim() : subs[0]) ?? null;
  return { primary, list: subs };
}

export async function queueRequestProAlert(args: AlertArgs) {
  if (!args.requestId || !args.userId) return;
  const admin = createServerClient();
  const { primary, list } = buildSubcategoryPayload(args.subcategory ?? null, args.subcategories);
  try {
    await admin
      .from("request_pro_alerts")
      .upsert(
        {
          request_id: args.requestId,
          user_id: args.userId,
          city: args.city ?? null,
          category: args.category ?? null,
          subcategory: primary,
          subcategories: list,
          request_title: args.requestTitle ?? null,
          last_checked_at: new Date().toISOString(),
        },
        { onConflict: "request_id" },
      );
  } catch {
    // Avoid breaking the response if the alert record fails
  }
}

export async function clearRequestProAlert(requestId: string | null | undefined) {
  if (!requestId) return;
  try {
    const admin = createServerClient();
    await admin.from("request_pro_alerts").delete().eq("request_id", requestId);
  } catch {
    // ignore
  }
}
