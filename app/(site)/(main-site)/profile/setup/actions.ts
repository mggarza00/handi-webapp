"use server";
import getServerClient from "@/lib/supabase/server-client";
import type { Database } from "@/types/supabase";
import { sendEmail } from "@/lib/email";
import {
  buildProfileChangeMessage,
  dedupeEmails,
  getAdminProfileEmails,
  getConfiguredAdminEmails,
  SUPPORT_EMAIL,
} from "@/lib/profile-change-notify";

type ProfilesRow = Database["public"]["Tables"]["profiles"]["Row"];
type ProfessionalsRow = Database["public"]["Tables"]["professionals"]["Row"];
type ChangePayload = {
  profiles: Record<string, unknown>;
  professionals: Record<string, unknown>;
  gallery_add_paths?: string[];
};

function parseCsvOrJson(value: string | null | undefined): Array<{ name: string }> | undefined {
  if (!value) return undefined;
  const v = value.trim();
  if (!v) return undefined;
  try {
    const parsed = JSON.parse(v) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .map((x) => (typeof x === "string" ? { name: x } : (x as { name?: string })))
        .filter((x) => x && typeof x.name === "string" && x.name.trim().length > 0)
        .map((x) => ({ name: x.name!.trim() }));
    }
  } catch {
    // fallthrough to CSV
  }
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => ({ name }));
}

function deepEqual(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return a === b;
  }
}

export async function createChangeRequest(formData: FormData): Promise<{ ok: boolean; error?: string }>
{
  const supabase = getServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return { ok: false, error: "UNAUTHENTICATED" };

  // Inputs
  const full_name = (formData.get("full_name") as string | null) ?? null;
  const avatar_url = (formData.get("avatar_url") as string | null) ?? null;
  const headline = (formData.get("headline") as string | null) ?? null;
  const bio = (formData.get("bio") as string | null) ?? null;
  const years_raw = (formData.get("years_experience") as string | null) ?? null;
  const years_experience = years_raw && years_raw.trim() !== "" ? Number(years_raw) : null;
  const city = (formData.get("city") as string | null) ?? null;
  const service_cities_raw = (formData.get("service_cities") as string | null) ?? null;
  const service_cities = (() => {
    const v = (service_cities_raw || "").trim();
    if (!v) return undefined;
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === "string").map((s) => s.trim()).filter(Boolean);
    } catch { /* csv fallback */ }
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  })();
  const categories = parseCsvOrJson((formData.get("categories") as string | null) ?? null);
  const subcategories = parseCsvOrJson((formData.get("subcategories") as string | null) ?? null);
  // Private gallery paths uploaded in setup (profiles-gallery). These require admin approval to publish.
  let gallery_paths: string[] | undefined = undefined;
  try {
    const raw = (formData.get("gallery_paths") as string | null) ?? null;
    if (raw && raw.trim()) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        gallery_paths = parsed.map((x) => String(x)).filter(Boolean);
      }
    }
  } catch {
    gallery_paths = undefined;
  }

  // Current data
  const { data: prof } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, role, city, bio, categories, subcategories")
    .eq("id", user.id)
    .maybeSingle<ProfilesRow>();
  const { data: pro } = await supabase
    .from("professionals")
    .select("headline, years_experience, city, cities, categories, subcategories, avatar_url, bio")
    .eq("id", user.id)
    .maybeSingle<ProfessionalsRow>();

  // Compute diffs
  const profChanges: Record<string, unknown> = {};
  const proChanges: Record<string, unknown> = {};

  if (full_name != null && full_name !== (prof?.full_name ?? null)) profChanges.full_name = full_name;
  if (avatar_url != null && avatar_url !== (prof?.avatar_url ?? null)) profChanges.avatar_url = avatar_url;
  // city pertenece a professionals en este esquema
  // Nota: bio/categorías/subcategorías solo se aplican en professionals

  if (headline != null && headline !== (pro?.headline ?? null)) proChanges.headline = headline;
  if (typeof years_experience === "number" && years_experience !== (pro?.years_experience ?? null))
    proChanges.years_experience = years_experience;
  if (city != null && city !== (pro?.city ?? null)) proChanges.city = city;
  if (service_cities && !deepEqual(service_cities, pro?.cities ?? null)) proChanges.cities = service_cities;
  if (bio != null && bio !== (pro?.bio ?? null)) proChanges.bio = bio;
  if (avatar_url != null && avatar_url !== (pro?.avatar_url ?? null)) proChanges.avatar_url = avatar_url;
  if (categories && !deepEqual(categories, (pro?.categories as unknown) ?? null)) proChanges.categories = categories;
  if (subcategories && !deepEqual(subcategories, (pro?.subcategories as unknown) ?? null))
    proChanges.subcategories = subcategories;

  const hasChanges = Object.keys(profChanges).length > 0 || Object.keys(proChanges).length > 0;
  if (!hasChanges) return { ok: false, error: "NO_CHANGES" };

  const payload: ChangePayload = { profiles: profChanges, professionals: proChanges };
  if (gallery_paths && gallery_paths.length) {
    // Store under a dedicated key for the approver flow
    payload.gallery_add_paths = gallery_paths;
  }

  const { error: insErr } = await supabase
    .from("profile_change_requests")
    .insert({ user_id: user.id, payload, status: "pending" });
  if (insErr) return { ok: false, error: `INSERT_FAILED: ${insErr.message}` };

  // Notify admins
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const link = `${base}/admin/pro-changes`;
  const message = buildProfileChangeMessage({
    userId: user.id,
    userEmail: user.email,
    userMetadata: (user.user_metadata ?? null) as Record<string, unknown> | null,
    profile: prof ?? null,
    professional: pro ?? null,
    profChanges,
    proChanges,
    galleryAddPaths: payload.gallery_add_paths ?? null,
    adminLink: link,
  });
  const configuredAdmins = getConfiguredAdminEmails();
  const profileAdminEmails = await getAdminProfileEmails();
  const recipients = dedupeEmails([...(configuredAdmins || []), ...profileAdminEmails, SUPPORT_EMAIL]);
  if (recipients.length > 0) {
    await sendEmail({ to: recipients, subject: message.subject, html: message.html }).catch(() => undefined);
  }
  // In-app notification to admins via RPC (SECURITY DEFINER)
  try {
    await supabase.rpc("notify_admins", {
      _type: "profile_change:requested",
      _title: "Solicitud de cambios de perfil",
      _body: message.notificationBody,
      _link: link,
    });
  } catch {
    // ignore notify errors
  }

  return { ok: true };
}
