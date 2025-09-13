import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { z } from "zod";

import type { Database } from "@/types/supabase";
import { sendEmail } from "@/lib/email";
import { getAdminSupabase } from "@/lib/supabase/admin";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const RefSchema = z.object({
  name: z.string(),
  phone: z.string(),
  relation: z.string(),
});
const PayloadSchema = z.object({
  full_name: z.string().min(2).max(120),
  phone: z.string().min(8).max(20),
  email: z.string().email(),
  empresa: z.boolean().optional(),
  services_desc: z.string().min(10).max(2000),
  cities: z.array(z.string().min(2).max(120)).min(1).max(20),
  categories: z.array(z.string().min(2).max(120)).min(1).max(20),
  subcategories: z.array(z.string().min(1).max(120)).max(50).optional(),
  years_experience: z.number().int().min(0).max(80),
  privacy_accept: z.literal(true),
  references: z.array(RefSchema).min(1).max(10),
  uploads: z.object({
    cv_url: z.string().url(),
    letters_urls: z.array(z.string().url()).min(1),
    id_front_url: z.string().url(),
    id_back_url: z.string().url(),
    signature_url: z.string().url(),
  }),
});

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json")) {
      return NextResponse.json(
        { ok: false, error: "UNSUPPORTED_MEDIA_TYPE" },
        { status: 415, headers: JSONH },
      );
    }
    const body: unknown = await req.json().catch(() => null);

    // Obtener usuario actual para permitir default de full_name desde profiles
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHENTICATED" },
        { status: 401, headers: JSONH },
      );
    }

    // Si no viene full_name en el payload, intentar tomarlo del perfil
    let defaultFullName: string | null = null;
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", auth.user.id)
        .maybeSingle();
      defaultFullName = (prof?.full_name || null) as string | null;
    } catch {
      // ignorar si la tabla o política no permite leer
    }

    const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object";
    const raw = isRecord(body) ? body : {};
    const maybeFullName = typeof raw["full_name"] === "string" ? (raw["full_name"] as string).trim() : "";
    const bodyWithDefaults = {
      ...raw,
      full_name: maybeFullName || (defaultFullName || ""),
    };

    const parsed = PayloadSchema.safeParse(bodyWithDefaults);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "VALIDATION_ERROR",
          detail: parsed.error.flatten(),
        },
        { status: 422, headers: JSONH },
      );
    }

    const p = parsed.data;
    // Persist registro (auditoría mínima)
    try {
      const admin = getAdminSupabase();
      await admin.from("pro_applications").insert({
        user_id: auth.user.id,
        full_name: p.full_name,
        phone: p.phone,
        email: p.email,
        empresa: p.empresa ?? false,
        services_desc: p.services_desc,
        cities: p.cities,
        categories: p.categories,
  subcategories: p.subcategories ?? null,
        years_experience: p.years_experience,
  refs: p.references,
        uploads: p.uploads,
        status: "pending",
      } as never);
      // In-app notifications for admins
      try {
        // Find admin users by is_admin flag or legacy role
        type AdminProfile = { id: string; role: string | null; is_admin: boolean | null };
        const { data: admins } = await admin
          .from("profiles")
          .select("id, role, is_admin")
          .or("is_admin.eq.true,role.eq.admin");
        const adminIds = ((admins || []) as AdminProfile[])
          .map((r) => r.id)
          .filter(Boolean);
        if (adminIds.length > 0) {
          const base =
            process.env.NEXT_PUBLIC_APP_URL ||
            process.env.NEXT_PUBLIC_SITE_URL ||
            "http://localhost:3000";
          const link = `${base}/admin/pro-applications`;
          const rows = adminIds.map((uid: string) => ({
            user_id: uid,
            type: "pro_application:new",
            title: "Nueva Postulación",
            body: `Nueva postulación de profesional: ${p.full_name}`,
            link,
          }));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (admin as any).from("user_notifications").insert(rows);
        }
      } catch {
        // ignore if notifications table is missing
      }
      // Also mark the user in `profiles` with boolean flags for roles (is_client, is_professional)
      try {
        // Upsert minimal row to set boolean flags; this won't remove other profile fields
        await admin
          .from("profiles")
          .upsert({ id: auth.user.id, is_professional: true, is_client: true }, { onConflict: "id" });
      } catch {
        // ignore if column/table missing or permission issues
      }
    } catch {
      // no-op si aún no existe la tabla
    }
  const adminTo =
      process.env.HANDEE_ADMIN_EMAIL ||
      process.env.MAIL_DEFAULT_TO ||
      "hola@handi.mx";
    const base =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000";
    const profileUrl = `${base}/profiles/${auth.user.id}`;
    const subject = `Nueva postulación profesional: ${p.full_name}`;
    const html = `
      <h2>Nueva postulación profesional</h2>
      <p><b>Nombre:</b> ${escapeHtml(p.full_name)}</p>
      <p><b>Teléfono:</b> ${escapeHtml(p.phone)}</p>
      <p><b>Correo:</b> ${escapeHtml(p.email)}</p>
      <p><b>Empresa:</b> ${p.empresa ? 'Sí' : 'No'}</p>
      <p><b>Experiencia (años):</b> ${p.years_experience}</p>
      <p><b>Categorías:</b> ${p.categories.map(escapeHtml).join(", ")}</p>
  ${p.subcategories && p.subcategories.length ? `<p><b>Subcategorías:</b> ${(p.subcategories as string[]).map(escapeHtml).join(", ")}</p>` : ""}
      <p><b>Ciudades:</b> ${p.cities.map(escapeHtml).join(", ")}</p>
      <p><b>Servicios:</b></p>
      <pre style="white-space:pre-wrap;font-family:ui-monospace,Consolas,monospace">${escapeHtml(p.services_desc)}</pre>
      <p><b>Referencias:</b></p>
      <ul>
        ${p.references.map((r) => `<li>${escapeHtml(r.name)} — ${escapeHtml(r.phone)} — ${escapeHtml(r.relation)}</li>`).join("")}
      </ul>
      <p><b>Archivos:</b></p>
      <ul>
        <li>CV: <a href="${p.uploads.cv_url}">${p.uploads.cv_url}</a></li>
        ${p.uploads.letters_urls.map((u) => `<li>Carta: <a href="${u}">${u}</a></li>`).join("")}
        <li>INE/Pasaporte (frente): <a href="${p.uploads.id_front_url}">${p.uploads.id_front_url}</a></li>
        <li>INE/Pasaporte (reverso): <a href="${p.uploads.id_back_url}">${p.uploads.id_back_url}</a></li>
        <li>Firma: <a href="${p.uploads.signature_url}">${p.uploads.signature_url}</a></li>
      </ul>
      <p><a href="${profileUrl}">Ver perfil</a></p>
    `;

    await sendEmail({ to: adminTo, subject, html });
    return NextResponse.json({ ok: true }, { headers: JSONH });
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

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
