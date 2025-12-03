import { NextResponse } from "next/server";

import { filterProfessionalsByRequest } from "@/lib/professionals/filter";
import { notifyFirstProfessionalAvailable } from "@/lib/notifications";
import { createServerClient } from "@/lib/supabase";
import type { Database } from "@/types/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;
const CRON_SECRET =
  (process.env.REQUEST_PRO_ALERTS_CRON_SECRET || process.env.CRON_SECRET || "").trim();

function isAuthorized(req: Request) {
  if (!CRON_SECRET) return true;
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  return token === CRON_SECRET;
}

async function runJob() {
  const admin = createServerClient();
  type AlertRow = Database["public"]["Tables"]["request_pro_alerts"]["Row"];
  type ProWithProfile = Database["public"]["Views"]["professionals_with_profile"]["Row"];
  const { data: alerts, error: alertsError } = await admin
    .from("request_pro_alerts")
    .select(
      "request_id, user_id, city, category, subcategory, subcategories, request_title, created_at",
    )
    .is("notified_at", null)
    .limit(50)
    .order("created_at", { ascending: true });
  if (alertsError) {
    throw new Error(alertsError.message);
  }
  const rows: AlertRow[] = Array.isArray(alerts) ? (alerts as AlertRow[]) : [];
  if (!rows.length) {
    return { processed: 0, notified: 0 };
  }

  const { data: pool, error: listError } = await admin
    .from("professionals_with_profile")
    .select(
      "id, full_name, avatar_url, headline, bio, rating, is_featured, last_active_at, city, cities, categories, subcategories, active",
    )
    .or("active.is.true,active.is.null")
    .order("is_featured", { ascending: false })
    .order("rating", { ascending: false, nullsFirst: false })
    .order("last_active_at", { ascending: false, nullsFirst: false })
    .limit(500);
  if (listError) {
    throw new Error(listError.message);
  }
  const professionals: ProWithProfile[] = Array.isArray(pool)
    ? (pool as ProWithProfile[])
    : [];

  let processed = 0;
  let notified = 0;
  for (const alert of rows) {
    processed += 1;
    const matches = filterProfessionalsByRequest(professionals, {
      city: alert.city ?? null,
      category: alert.category ?? null,
      subcategory: alert.subcategory ?? null,
      includeIncomplete: false,
    });
    const nowIso = new Date().toISOString();
    if (!matches.length) {
      const updatePayload: Database["public"]["Tables"]["request_pro_alerts"]["Update"] = {
        last_checked_at: nowIso,
      };
      await admin
        .from("request_pro_alerts")
        .update(updatePayload)
        .eq("request_id", alert.request_id);
      continue;
    }
    const first = matches[0] as ProWithProfile;
    const firstId = first?.id ?? null;
    const firstName = first?.full_name ?? null;
    await notifyFirstProfessionalAvailable({
      request_id: alert.request_id,
      user_id: alert.user_id,
      request_title: alert.request_title ?? null,
      professional_id: firstId,
      professional_name: firstName,
    });
    const updateAlert: Database["public"]["Tables"]["request_pro_alerts"]["Update"] = {
      last_checked_at: nowIso,
      notified_at: nowIso,
      first_professional_id: firstId,
      first_professional_snapshot: first ?? null,
    };
    await admin
      .from("request_pro_alerts")
      .update(updateAlert)
      .eq("request_id", alert.request_id);
    notified += 1;
  }

  return { processed, notified };
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401, headers: JSONH });
  }
  try {
    const result = await runJob();
    return NextResponse.json({ ok: true, ...result }, { status: 200, headers: JSONH });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNKNOWN";
    return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: JSONH });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
