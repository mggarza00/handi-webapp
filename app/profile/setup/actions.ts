"use server";
import { cookies } from "next/headers";
import { createServerActionClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/supabase";
import { sendEmail } from "@/lib/email";

type Role = "client" | "pro" | "admin" | null;

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

function listAdmins(): string[] {
  const env = (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const legacy = (process.env.HANDEE_ADMIN_EMAIL || process.env.MAIL_DEFAULT_TO || "").trim();
  const result = new Set<string>();
  for (const e of env) result.add(e);
  if (legacy) result.add(legacy);
  return Array.from(result);
}

export async function createChangeRequest(formData: FormData): Promise<{ ok: boolean; error?: string }>
{
  const supabase = createServerActionClient<Database>({ cookies });
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
  const categories = parseCsvOrJson((formData.get("categories") as string | null) ?? null);
  const subcategories = parseCsvOrJson((formData.get("subcategories") as string | null) ?? null);

  // Current data
  const { data: prof } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, role, city, bio, categories, subcategories")
    .eq("id", user.id)
    .maybeSingle();
  const { data: pro } = await supabase
    .from("professionals")
    .select("headline, years_experience, city, categories, subcategories, avatar_url, bio")
    .eq("id", user.id)
    .maybeSingle();

  // Compute diffs
  const profChanges: Record<string, unknown> = {};
  const proChanges: Record<string, unknown> = {};

  if (full_name != null && full_name !== (prof?.full_name ?? null)) profChanges.full_name = full_name;
  if (avatar_url != null && avatar_url !== (prof?.avatar_url ?? null)) profChanges.avatar_url = avatar_url;
  if (city != null && city !== (prof?.city ?? null)) profChanges.city = city;
  if (bio != null && bio !== (prof?.bio ?? null)) profChanges.bio = bio;
  if (categories && !deepEqual(categories, (prof?.categories as unknown) ?? null)) profChanges.categories = categories;
  if (subcategories && !deepEqual(subcategories, (prof?.subcategories as unknown) ?? null)) profChanges.subcategories = subcategories;

  if (headline != null && headline !== (pro?.headline ?? null)) proChanges.headline = headline;
  if (typeof years_experience === "number" && years_experience !== (pro?.years_experience ?? null)) proChanges.years_experience = years_experience;
  if (city != null && city !== (pro?.city ?? null)) proChanges.city = city;
  if (bio != null && bio !== (pro?.bio ?? null)) proChanges.bio = bio;
  if (avatar_url != null && avatar_url !== (pro?.avatar_url ?? null)) proChanges.avatar_url = avatar_url;
  if (categories && !deepEqual(categories, (pro?.categories as unknown) ?? null)) proChanges.categories = categories;
  if (subcategories && !deepEqual(subcategories, (pro?.subcategories as unknown) ?? null)) proChanges.subcategories = subcategories;

  const hasChanges = Object.keys(profChanges).length > 0 || Object.keys(proChanges).length > 0;
  if (!hasChanges) return { ok: false, error: "NO_CHANGES" };

  const payload = { profiles: profChanges, professionals: proChanges } as const;

  const { error: insErr } = await supabase
    .from("profile_change_requests")
    .insert({ user_id: user.id, payload, status: "pending" });
  if (insErr) return { ok: false, error: "INSERT_FAILED" };

  // Notify admins
  const admins = listAdmins();
  if (admins.length > 0) {
    const base = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const subject = "HANDI · Solicitud de cambios de perfil";
    const summary: string[] = [];
    for (const k of Object.keys(profChanges)) summary.push(`profiles.${k}`);
    for (const k of Object.keys(proChanges)) summary.push(`professionals.${k}`);
    const link = `${base}/admin/profile-requests`;
    const html = `
      <h1>Nueva solicitud de cambios de perfil</h1>
      <p>Usuario: <code>${user.id}</code></p>
      <p>Campos: ${summary.join(", ") || "(sin resumen)"}</p>
      <p><a href="${link}">Abrir panel admin</a></p>
    `;
    await Promise.all(
      admins.map((to) => sendEmail({ to, subject, html })),
    ).catch(() => undefined);
  }

  return { ok: true };
}

