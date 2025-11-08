import { NextResponse } from "next/server";
import createClient from "@/utils/supabase/server";
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
const RFC_REGEX = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/;

const PayloadSchema = z
  .object({
    full_name: z.string().min(2).max(120),
    phone: z.string().min(8).max(20),
    email: z.string().email(),
    rfc: z
      .string()
      .trim()
      .transform((s) => s.toUpperCase())
      .refine((s) => RFC_REGEX.test(s), "RFC inválido"),
    empresa: z.boolean().optional(),
    company_legal_name: z.string().min(2).optional(),
    company_industry: z.string().min(1).optional(),
    company_employees_count: z.number().int().min(1).optional(),
    company_website: z
      .string()
      .optional()
      .refine((s) => !s || /^https?:\/\//i.test(s), "Sitio inválido"),
    services_desc: z.string().min(10).max(2000),
    cities: z.array(z.string().min(2).max(120)).min(1).max(20),
    categories: z.array(z.string().min(2).max(120)).min(1).max(20),
    subcategories: z.array(z.string().min(1).max(120)).max(50).optional(),
    years_experience: z.number().int().min(0).max(80),
    privacy_accept: z.literal(true),
    references: z.array(RefSchema).min(1).max(10),
    uploads: z.object({
      // legacy (persona física) - ahora opcional
      cv_url: z.string().url().optional(),
      letters_urls: z.array(z.string().url()).min(1).optional(),
      id_front_url: z.string().url().optional(),
      id_back_url: z.string().url().optional(),
      // nuevo para empresa
      company_doc_incorporation_url: z.string().url().optional(),
      company_csf_url: z.string().url().optional(),
      company_rep_id_front_url: z.string().url().optional(),
      company_rep_id_back_url: z.string().url().optional(),
      // firma (se mantiene)
      signature_url: z.string().url().optional(),
    }),
  })
  .superRefine((data, ctx) => {
    if (data.empresa) {
      if (!data.company_legal_name || data.company_legal_name.trim().length < 2) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["company_legal_name"], message: "Requerido" });
      }
      if (!data.company_industry || data.company_industry.trim().length < 1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["company_industry"], message: "Requerido" });
      }
      if (data.company_employees_count != null && (!Number.isInteger(data.company_employees_count) || data.company_employees_count < 1)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["company_employees_count"], message: "Inválido" });
      }
      if (data.company_website && !/^https?:\/\//i.test(data.company_website)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["company_website"], message: "Inválido" });
      }
      if (!data.uploads.company_doc_incorporation_url) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["uploads", "company_doc_incorporation_url"], message: "Requerido" });
      }
      if (!data.uploads.company_csf_url) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["uploads", "company_csf_url"], message: "Requerido" });
      }
    }
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
    const supabase = createClient();
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
      const { data: prof } = await (supabase as any)
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
    // Persist registro (auditoría) – asegurar inserción aunque no haya SERVICE_ROLE
    const admin = (() => {
      try {
        return getAdminSupabase();
      } catch {
        return null;
      }
    })();
    const record = {
      user_id: auth.user.id,
      full_name: p.full_name,
      phone: p.phone,
      email: p.email,
      rfc: p.rfc,
      empresa: p.empresa ?? false,
      is_company: p.empresa ?? false,
      company_legal_name: p.company_legal_name ?? null,
      company_industry: p.company_industry ?? null,
      company_employees_count: p.company_employees_count ?? null,
      company_website: p.company_website ?? null,
      company_doc_incorporation_url: (p.uploads as Record<string, unknown>).company_doc_incorporation_url ?? null,
      company_csf_url: (p.uploads as Record<string, unknown>).company_csf_url ?? null,
      company_rep_id_front_url: (p.uploads as Record<string, unknown>).company_rep_id_front_url ?? null,
      company_rep_id_back_url: (p.uploads as Record<string, unknown>).company_rep_id_back_url ?? null,
      services_desc: p.services_desc,
      cities: p.cities,
      categories: p.categories,
      subcategories: p.subcategories ?? null,
      years_experience: p.years_experience,
      refs: p.references,
      uploads: p.uploads,
      status: "pending",
    } as Record<string, unknown>;

    let inserted = false;
    let insertErr: unknown = null;
    // Try full record (admin → user)
    if (admin) {
      const { error } = await (admin as any)
        .from("pro_applications")
        .insert([record]);
      if (!error) inserted = true; else insertErr = error;
    }
    if (!inserted) {
      const { error } = await (supabase as any)
        .from("pro_applications")
        .insert([record]);
      if (!error) inserted = true; else insertErr = insertErr || error;
    }
    // If failed, try minimal backward-compatible payload (older schemas)
    if (!inserted) {
      const minimal = {
        user_id: auth.user.id,
        full_name: p.full_name,
        phone: p.phone,
        email: p.email,
        services_desc: p.services_desc,
        cities: p.cities,
        categories: p.categories,
        years_experience: p.years_experience,
        refs: p.references,
        uploads: p.uploads,
        status: "pending",
      } as Record<string, unknown>;
      if (admin) {
        const { error } = await (admin as any)
          .from("pro_applications")
          .insert([minimal]);
        if (!error) inserted = true; else insertErr = insertErr || error;
      }
      if (!inserted) {
        const { error } = await (supabase as any)
          .from("pro_applications")
          .insert([minimal]);
        if (!error) inserted = true; else insertErr = insertErr || error;
      }
    }
    if (!inserted) {
      const detail = (insertErr as { message?: string } | null)?.message || "insert_failed";
      try { console.error("pro_applications insert failed:", insertErr); } catch {}
      return NextResponse.json(
        { ok: false, error: "INSERT_FAILED", detail },
        { status: 500, headers: JSONH },
      );
    }

    // In-app notifications para admins (best-effort)
    if (admin) {
      try {
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
      // Marcar flags auxiliares en profiles (best-effort; ignorable en dev)
      try {
        await admin
          .from("profiles")
          .upsert({ id: auth.user.id, is_professional: true, is_client: true }, { onConflict: "id" });
      } catch {
        /* ignore */
      }
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
      <p><b>RFC:</b> ${escapeHtml(p.rfc)}</p>
      <p><b>Empresa:</b> ${p.empresa ? 'Sí' : 'No'}</p>
      ${p.empresa ? `
      <p><b>Razón social:</b> ${escapeHtml(p.company_legal_name || '')}</p>
      <p><b>Giro:</b> ${escapeHtml(p.company_industry || '')}</p>
      ${p.company_employees_count ? `<p><b>Empleados:</b> ${p.company_employees_count}</p>` : ''}
      ${p.company_website ? `<p><b>Sitio:</b> ${escapeHtml(p.company_website)}</p>` : ''}
      <p><b>Docs empresa:</b></p>
      <ul>
        ${p.uploads.company_doc_incorporation_url ? `<li>Acta: <a href="${p.uploads.company_doc_incorporation_url}">${p.uploads.company_doc_incorporation_url}</a></li>` : ''}
        ${p.uploads.company_csf_url ? `<li>CSF: <a href="${p.uploads.company_csf_url}">${p.uploads.company_csf_url}</a></li>` : ''}
        ${p.uploads.company_rep_id_front_url ? `<li>ID Rep (frente): <a href="${p.uploads.company_rep_id_front_url}">${p.uploads.company_rep_id_front_url}</a></li>` : ''}
        ${p.uploads.company_rep_id_back_url ? `<li>ID Rep (reverso): <a href="${p.uploads.company_rep_id_back_url}">${p.uploads.company_rep_id_back_url}</a></li>` : ''}
      </ul>
      ` : ''}
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
      ${!p.empresa ? `
      <ul>
        ${p.uploads.cv_url ? `<li>CV: <a href="${p.uploads.cv_url}">${p.uploads.cv_url}</a></li>` : ''}
        ${Array.isArray(p.uploads.letters_urls) ? p.uploads.letters_urls.map((u: string) => `<li>Carta: <a href="${u}">${u}</a></li>`).join("") : ''}
        ${p.uploads.id_front_url ? `<li>Identificación (frente): <a href="${p.uploads.id_front_url}">${p.uploads.id_front_url}</a></li>` : ''}
        ${p.uploads.id_back_url ? `<li>Identificación (reverso): <a href="${p.uploads.id_back_url}">${p.uploads.id_back_url}</a></li>` : ''}
        ${p.uploads.signature_url ? `<li>Firma: <a href="${p.uploads.signature_url}">${p.uploads.signature_url}</a></li>` : ''}
      </ul>
      ` : ''}
      <p><a href="${profileUrl}">Ver perfil</a></p>
    `;

    const mailRes = await sendEmail({ to: adminTo, subject, html });
    if (!mailRes.ok) {
      // Log para diagnóstico en Vercel sin interrumpir el flujo
      console.warn('[email] pro-application notify failed', { error: mailRes.error, hint: mailRes.hint });
    }
    return NextResponse.json({ ok: true, emailOk: mailRes.ok }, { status: 200, headers: JSONH });
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
