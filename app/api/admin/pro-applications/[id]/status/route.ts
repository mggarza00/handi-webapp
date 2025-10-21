/* eslint-disable import/order */
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminSupabase } from "../../../../../../lib/supabase/admin";
import { notifyProApplicationDecision } from "@/lib/notifications";
import { assertAdminOrJson } from "@/lib/auth-admin";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;
const Schema = z.object({
  status: z.enum(["pending", "accepted", "rejected"]),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const guard = await assertAdminOrJson();
  if (!guard.ok) return guard.res;
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { ok: false, error: "VALIDATION_ERROR" },
      { status: 422, headers: JSONH },
    );
  try {
    const admin = getAdminSupabase();
    const upd = await admin
      .from("pro_applications")
      .update({
        status: parsed.data.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .select("id,status,updated_at,user_id")
      .single();
    if (upd.error) throw upd.error;
    const uid = (upd.data as unknown as { user_id?: string })?.user_id;

    // If approved, create/update a public professional profile row linked to this user
    if (parsed.data.status === "accepted" && uid) {
      try {
        const { data: app } = await admin
          .from("pro_applications")
          .select("full_name, cities, categories, subcategories, years_experience, empresa, is_company, rfc, company_legal_name, company_industry, company_employees_count, company_website, company_doc_incorporation_url, company_csf_url, company_rep_id_front_url, company_rep_id_back_url")
          .eq("id", params.id)
          .single();
        const patch: Record<string, unknown> = {
          active: true,
          last_active_at: new Date().toISOString(),
        };
        if (app) {
          if (app.full_name) patch.full_name = app.full_name;
          if ((app as unknown as { rfc?: string | null }).rfc)
            patch.rfc = (app as unknown as { rfc?: string | null }).rfc as string;
          const appEmpresa = Boolean((app as unknown as { empresa?: boolean | null }).empresa);
          const appIsCompany = Boolean((app as unknown as { is_company?: boolean | null }).is_company);
          if (appEmpresa || appIsCompany) {
            patch.is_company = true;
          }
          if ((app as unknown as { empresa?: boolean | null }).empresa != null)
            patch.empresa = Boolean(
              (app as unknown as { empresa?: boolean | null }).empresa,
            );
          // Company fields
          const appObj = app as unknown as Record<string, unknown>;
          const copyIf = (k: string) => {
            const v = appObj[k];
            if (v != null) (patch as Record<string, unknown>)[k] = v as unknown;
          };
          copyIf("company_legal_name");
          copyIf("company_industry");
          copyIf("company_employees_count");
          copyIf("company_website");
          copyIf("company_doc_incorporation_url");
          copyIf("company_csf_url");
          copyIf("company_rep_id_front_url");
          copyIf("company_rep_id_back_url");
          // cities: keep as array of strings; set main city if missing
          if (app.cities) {
            patch.cities = app.cities;
            const arr = Array.isArray(app.cities)
              ? (app.cities as unknown[]).filter((x) => typeof x === "string")
              : [];
            if (arr.length > 0) patch.city = arr[0] as string;
          }
          // categories: normalize to array of { name }
          if (app.categories) {
            const normalized = Array.isArray(app.categories)
              ? (app.categories as unknown[])
                  .map((c) =>
                    typeof c === "string"
                      ? { name: c }
                      : c && typeof c === "object"
                        ? (c as Record<string, unknown>)
                        : null,
                  )
                  .filter((x): x is Record<string, unknown> => !!x)
              : [];
            if (normalized.length > 0) patch.categories = normalized as unknown;
          }
          // subcategories: normalize to array of { name }
          const appSubs = (app as unknown as { subcategories?: unknown[] | null })
            .subcategories;
          if (appSubs) {
            const normalizedSubs = Array.isArray(appSubs)
              ? (appSubs as unknown[])
                  .map((c) =>
                    typeof c === "string"
                      ? { name: c }
                      : c && typeof c === "object"
                        ? (c as Record<string, unknown>)
                        : null,
                  )
                  .filter((x): x is Record<string, unknown> => !!x)
              : [];
            if (normalizedSubs.length > 0)
              (patch as Record<string, unknown>).subcategories = normalizedSubs as unknown;
          }
          if (app.years_experience != null)
            patch.years_experience = app.years_experience as unknown as number;
        }
        // Upsert professionals row with id = user_id (1:1)
        const existing = await admin
          .from("professionals")
          .select("id")
          .eq("id", uid)
          .maybeSingle();
        if (existing.data) {
          await admin.from("professionals").update(patch).eq("id", uid);
        } else {
          await admin
            .from("professionals")
            .insert([{ id: uid, ...patch } as Record<string, unknown>]);
        }
        // Sync profiles.full_name si viene en la solicitud
        try {
          const name = (patch.full_name as string | null) || null;
          if (typeof name === "string" && name.trim().length >= 2) {
            await admin.from("profiles").update({ full_name: name.trim() }).eq("id", uid);
          }
        } catch {
          /* ignore */
        }
        // Optionally mark profile as pro-enabled for UI switches
        try {
          await admin.from("profiles").update({ role: "pro" }).eq("id", uid);
        } catch {
          /* ignore */
        }
      } catch {
        // ignore profile sync errors
      }
      // In-app notification for the professional (accepted)
      try {
        const base =
          process.env.NEXT_PUBLIC_APP_URL ||
          process.env.NEXT_PUBLIC_SITE_URL ||
          "http://localhost:3000";
        const link = `${base}/requests/explore`;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any).from("user_notifications").insert({
          user_id: uid,
          type: "pro_application:accepted",
          title: "Solicitud aprobada",
          body: "Tu postulación como profesional fue aprobada. Ya puedes ver trabajos disponibles.",
          link,
        });
      } catch {
        // ignore if table missing
      }
    } else if (parsed.data.status === "rejected" && uid) {
      // In-app notification for the professional (rejected)
      try {
        const base =
          process.env.NEXT_PUBLIC_APP_URL ||
          process.env.NEXT_PUBLIC_SITE_URL ||
          "http://localhost:3000";
        const link = `${base}/pro-apply`;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any).from("user_notifications").insert({
          user_id: uid,
          type: "pro_application:rejected",
          title: "Solicitud rechazada",
          body: "Tu postulación fue rechazada. Puedes revisar tus datos e intentar nuevamente.",
          link,
        });
      } catch {
        // ignore if table missing
      }
    }
  // Avisar por email al profesional
    try {
      if (uid && (parsed.data.status === "accepted" || parsed.data.status === "rejected")) {
        await notifyProApplicationDecision({ user_id: uid, status: parsed.data.status });
      }
    } catch {
      // ignore email errors
    }
    return NextResponse.json({ ok: true, data: upd.data }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500, headers: JSONH },
    );
  }
}

export function GET() {
  return NextResponse.json(
    { ok: false, error: "METHOD_NOT_ALLOWED" },
    { status: 405, headers: JSONH },
  );
}
