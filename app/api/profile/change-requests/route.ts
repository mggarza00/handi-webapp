import { NextResponse } from "next/server";
import { z } from "zod";
import createClient from "@/utils/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import {
  buildProfileChangeMessage,
  dedupeEmails,
  getConfiguredAdminEmails,
  SUPPORT_EMAIL,
} from "@/lib/profile-change-notify";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const Body = z.object({
  full_name: z.string().optional().nullable(),
  avatar_url: z.string().optional().nullable(),
  headline: z.string().optional().nullable(),
  bio: z.string().optional().nullable(),
  years_experience: z.number().int().min(0).max(80).optional().nullable(),
  city: z.string().optional().nullable(),
  service_cities: z.array(z.string()).optional().nullable(),
  categories: z.array(z.string()).optional().nullable(),
  subcategories: z.array(z.string()).optional().nullable(),
  gallery_paths: z.array(z.string()).optional().nullable(),
});

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user)
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401, headers: JSONH });

    const json = await req.json().catch(() => null);
    const parsed = Body.safeParse(json);
    if (!parsed.success)
      return NextResponse.json({ ok: false, error: "BAD_REQUEST", detail: parsed.error.flatten() }, { status: 400, headers: JSONH });

    const body = parsed.data;
    const toNamed = (arr?: string[] | null) =>
      Array.isArray(arr) ? arr.map((name) => ({ name })) : undefined;

    // Current data
    const sb: any = supabase as any;
    const { data: prof } = await sb
      .from("profiles")
      .select("full_name, avatar_url, role, city, bio, categories, subcategories")
      .eq("id", user.id)
      .maybeSingle();
    const { data: pro } = await sb
      .from("professionals")
      .select("headline, years_experience, city, cities, categories, subcategories, avatar_url, bio")
      .eq("id", user.id)
      .maybeSingle();

    const deepEq = (a: unknown, b: unknown) => {
      try { return JSON.stringify(a) === JSON.stringify(b); } catch { return a === b; }
    };

    const profChanges: Record<string, unknown> = {};
    const proChanges: Record<string, unknown> = {};

    if (body.full_name != null && body.full_name !== (prof?.full_name ?? null)) profChanges.full_name = body.full_name;
    if (body.avatar_url != null && body.avatar_url !== (prof?.avatar_url ?? null)) profChanges.avatar_url = body.avatar_url;
    // city pertenece a professionals en este esquema (no en profiles)
    // Nota: bio/categorías/subcategorías solo se aplican en professionals

    if (body.headline != null && body.headline !== (pro?.headline ?? null)) proChanges.headline = body.headline;
    if (typeof body.years_experience === "number" && body.years_experience !== (pro?.years_experience ?? null)) proChanges.years_experience = body.years_experience;
    if (body.city != null && body.city !== (pro?.city ?? null)) proChanges.city = body.city;
    if (body.service_cities && !deepEq(body.service_cities, (pro as any)?.cities ?? null)) (proChanges as any).cities = body.service_cities;
    if (body.bio != null && body.bio !== (pro?.bio ?? null)) proChanges.bio = body.bio;
    if (body.avatar_url != null && body.avatar_url !== (pro?.avatar_url ?? null)) proChanges.avatar_url = body.avatar_url;
    if (body.categories && !deepEq(toNamed(body.categories), (pro?.categories as unknown) ?? null)) proChanges.categories = toNamed(body.categories);
    if (body.subcategories && !deepEq(toNamed(body.subcategories), (pro?.subcategories as unknown) ?? null)) proChanges.subcategories = toNamed(body.subcategories);

    const hasChanges = Object.keys(profChanges).length > 0 || Object.keys(proChanges).length > 0 || (Array.isArray(body.gallery_paths) && body.gallery_paths.length > 0);
    if (!hasChanges)
      return NextResponse.json({ ok: false, error: "NO_CHANGES" }, { status: 400, headers: JSONH });

    const payload: Record<string, unknown> = { profiles: profChanges, professionals: proChanges } as any;
    if (Array.isArray(body.gallery_paths) && body.gallery_paths.length) {
      (payload as any).gallery_add_paths = body.gallery_paths;
    }

    // Use service role to insert (avoids RLS edge cases on some environments)
    const admin = getAdminSupabase() as any;
    const { error: insErr } = await admin
      .from("profile_change_requests")
      .insert({ user_id: user.id, payload, status: "pending" } as any);
    if (insErr)
      return NextResponse.json({ ok: false, error: `INSERT_FAILED: ${insErr.message}` }, { status: 400, headers: JSONH });

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
      galleryAddPaths: Array.isArray(body.gallery_paths) ? body.gallery_paths : null,
      adminLink: link,
    });

    // In-app notification to admins (direct insert; service role bypasses RLS)
    try {
      const admins = await (admin as any)
        .from("profiles")
        .select("id, role, is_admin, email")
        .or("role.eq.admin,is_admin.eq.true");
      const rows = Array.isArray(admins?.data) ? admins.data : [];
      if (rows.length) {
        await (admin as any).from("user_notifications").insert(
          rows.map((r: any) => ({
            user_id: r.id,
            type: "profile_change:requested",
            title: "Solicitud de cambios de perfil",
            body: message.notificationBody,
            link,
          })),
        );
      }
      const configuredAdmins = getConfiguredAdminEmails();
      const adminEmails = rows
        .map((row: any) => (typeof row.email === "string" ? row.email.trim() : ""))
        .filter((email: string | null): email is string => Boolean(email && email.length));
      const recipients = dedupeEmails([...(configuredAdmins || []), ...adminEmails, SUPPORT_EMAIL]);
      if (recipients.length) {
        await sendEmail({ to: recipients, subject: message.subject, html: message.html }).catch(() => undefined);
      }
    } catch { /* ignore */ }

    return NextResponse.json({ ok: true }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR", detail: msg }, { status: 500, headers: JSONH });
  }
}

export function GET() {
  return NextResponse.json({ ok: false, error: "METHOD_NOT_ALLOWED" }, { status: 405, headers: JSONH });
}
