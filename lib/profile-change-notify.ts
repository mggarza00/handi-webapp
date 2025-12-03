import { getAdminSupabase } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";

type ProfilesRow = Database["public"]["Tables"]["profiles"]["Row"];
type ProfessionalsRow = Database["public"]["Tables"]["professionals"]["Row"];

export type ProfileChangeMessageArgs = {
  userId: string;
  userEmail?: string | null;
  userMetadata?: Record<string, unknown> | null;
  profile?: Partial<ProfilesRow> | null;
  professional?: Partial<ProfessionalsRow> | null;
  profChanges: Record<string, unknown>;
  proChanges: Record<string, unknown>;
  galleryAddPaths?: string[] | null;
  adminLink: string;
};

export type ProfileChangeMessage = {
  displayName: string;
  summaryFields: string[];
  notificationBody: string;
  subject: string;
  html: string;
};

type ChangeDetail = { path: string; before: string; after: string };

const NAME_META_KEYS = ["full_name", "name", "user_name", "preferred_username"] as const;
export const SUPPORT_EMAIL = "soporte@handi.mx";

export function getConfiguredAdminEmails(): string[] {
  const envList = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const legacy = (process.env.HANDEE_ADMIN_EMAIL || process.env.MAIL_DEFAULT_TO || "").trim();
  const inputs = [...envList, legacy].filter(Boolean);
  return dedupeEmails(inputs as string[]);
}

export async function getAdminProfileEmails(): Promise<string[]> {
  try {
    const admin = getAdminSupabase();
    const { data, error } = await admin
      .from("profiles")
      .select("email")
      .or("role.eq.admin,is_admin.eq.true")
      .not("email", "is", null);
    if (error || !data) return [];
    const emails = (data as Array<{ email?: string | null }>)
      .map((row) => (typeof row.email === "string" ? row.email.trim() : ""))
      .filter(Boolean);
    return dedupeEmails(emails);
  } catch {
    return [];
  }
}

export function dedupeEmails(emails: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of emails) {
    const email = (raw || "").trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(email);
  }
  return result;
}

export function buildProfileChangeMessage(args: ProfileChangeMessageArgs): ProfileChangeMessage {
  const details = buildChangeDetails(args);
  const summaryFields = details.map((detail) => detail.path);
  const summaryDisplay = summaryFields.length ? summaryFields.join(", ") : "(sin campos detectados)";
  const displayName = resolveDisplayName(args);
  const userEmail = normalizeString(args.userEmail) ?? "Sin correo registrado";
  const htmlRows = details
    .map(
      (detail) => `
        <tr>
          <td style="padding: 8px; border: 1px solid #e2e8f0;">${escapeHtml(detail.path)}</td>
          <td style="padding: 8px; border: 1px solid #e2e8f0; color: #64748b;">${formatHtml(detail.before)}</td>
          <td style="padding: 8px; border: 1px solid #e2e8f0; color: #0f172a; font-weight: 600;">${formatHtml(detail.after)}</td>
        </tr>
      `,
    )
    .join("");

  const htmlTableBody =
    htmlRows.trim().length > 0
      ? htmlRows
      : `
        <tr>
          <td colspan="3" style="padding: 12px; text-align: center; color: #64748b;">
            Sin detalles para mostrar.
          </td>
        </tr>
      `;

  const subject = summaryFields.length
    ? `HANDI - Nueva solicitud de cambios de perfil (${displayName})`
    : `HANDI - Solicitud de cambios de perfil`;

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 14px; color: #0f172a;">
      <h1 style="font-size: 18px; margin-bottom: 16px;">Nueva solicitud de cambios de perfil</h1>
      <p><strong>Profesional:</strong> ${escapeHtml(displayName)}</p>
      <p><strong>Email:</strong> ${escapeHtml(userEmail)}</p>
      <p><strong>ID:</strong> <code>${escapeHtml(args.userId)}</code></p>
      <p><strong>Campos:</strong> ${escapeHtml(summaryDisplay)}</p>
      <table style="border-collapse: collapse; width: 100%; margin-top: 12px;">
        <thead>
          <tr style="background: #f1f5f9; text-align: left;">
            <th style="padding: 8px; border: 1px solid #e2e8f0;">Campo</th>
            <th style="padding: 8px; border: 1px solid #e2e8f0;">Anterior</th>
            <th style="padding: 8px; border: 1px solid #e2e8f0;">Propuesto</th>
          </tr>
        </thead>
        <tbody>
          ${htmlTableBody}
        </tbody>
      </table>
      <p style="margin-top: 16px;">
        <a href="${escapeHtml(args.adminLink)}" style="display: inline-block; padding: 10px 16px; background: #0f172a; color: #fff; text-decoration: none; border-radius: 4px;">
          Abrir panel admin
        </a>
      </p>
    </div>
  `;

  const notificationBody = summaryFields.length
    ? `${displayName} solicitó cambios en ${summaryFields.join(", ")}`
    : `${displayName} solicitó cambios de perfil`;

  return { displayName, summaryFields, notificationBody, subject, html };
}

function resolveDisplayName(args: ProfileChangeMessageArgs): string {
  const fullNameRaw = args.profChanges["full_name"];
  const profName = normalizeString(fullNameRaw);
  if (profName) return profName;
  const profileName = normalizeString(args.profile?.full_name ?? null);
  if (profileName) return profileName;
  const metaName = resolveMetadataName(args.userMetadata);
  if (metaName) return metaName;
  const email = normalizeString(args.userEmail);
  if (email) return email;
  return args.userId;
}

function resolveMetadataName(meta?: Record<string, unknown> | null): string | null {
  if (!meta) return null;
  for (const key of NAME_META_KEYS) {
    const normalized = normalizeString(meta[key]);
    if (normalized) return normalized;
  }
  return null;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildChangeDetails(args: ProfileChangeMessageArgs): ChangeDetail[] {
  const details: ChangeDetail[] = [];
  const profileBefore = (args.profile ?? null) as Record<string, unknown> | null;
  const professionalBefore = (args.professional ?? null) as Record<string, unknown> | null;

  for (const [key, value] of Object.entries(args.profChanges)) {
    details.push({
      path: `profiles.${key}`,
      before: formatValue(profileBefore?.[key]),
      after: formatValue(value),
    });
  }

  for (const [key, value] of Object.entries(args.proChanges)) {
    details.push({
      path: `professionals.${key}`,
      before: formatValue(professionalBefore?.[key]),
      after: formatValue(value),
    });
  }

  if (Array.isArray(args.galleryAddPaths) && args.galleryAddPaths.length > 0) {
    const previewNames = args.galleryAddPaths
      .slice(0, 3)
      .map((item) => {
        try {
          const parts = item.split("/");
          return parts[parts.length - 1] || item;
        } catch {
          return item;
        }
      })
      .join(", ");
    const extra = args.galleryAddPaths.length > 3 ? ` +${args.galleryAddPaths.length - 3} más` : "";
    details.push({
      path: "gallery.add_paths",
      before: "(sin archivos nuevos)",
      after: `${args.galleryAddPaths.length} archivo(s): ${previewNames}${extra}`,
    });
  }

  return details;
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null) return "(sin valor)";
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : "(sin valor)";
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (!value.length) return "(lista vacía)";
    const parts = value
      .map((entry) => {
        if (typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean") {
          return String(entry);
        }
        if (entry && typeof entry === "object" && typeof (entry as { name?: unknown }).name === "string") {
          return ((entry as { name: string }).name || "").trim();
        }
        return null;
      })
      .filter((entry): entry is string => Boolean(entry && entry.trim()));
    return parts.length ? parts.join(", ") : JSON.stringify(value);
  }
  if (value instanceof Date) return value.toISOString();
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatHtml(value: string): string {
  return escapeHtml(value).replace(/\n/g, "<br />");
}
