import { NextResponse } from "next/server";

import { hasUsableAvatar } from "@/lib/chat/chat-identity";
import { getAdminSupabase } from "@/lib/supabase/admin";
import createClient from "@/utils/supabase/server";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const parseNamesArray = (input: string): unknown[] | string | null => {
  try {
    const parsed = JSON.parse(input);
    if (Array.isArray(parsed)) return parsed as unknown[];
    if (typeof parsed === "string") return parsed;
    return null;
  } catch {
    return null;
  }
};

const fromCommaSeparated = (value: string): string[] =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const toNames = (value: unknown): string[] => {
  const visit = (v: unknown): string[] => {
    if (Array.isArray(v)) return v.flatMap((item) => visit(item));
    if (typeof v === "string") {
      const s = v.trim();
      if (!s) return [];
      const parsed = parseNamesArray(s);
      if (parsed !== null) return visit(parsed);
      return s.includes(",") ? fromCommaSeparated(s) : [s];
    }
    if (v && typeof v === "object") {
      const name = (v as { name?: unknown }).name;
      return typeof name === "string" ? visit(name) : [];
    }
    return [];
  };
  return Array.from(
    new Set(
      visit(value)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
};

const asTrimmed = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const pickBestAvatar = (...candidates: Array<unknown>): string | null => {
  const normalized = candidates
    .map((value) => asTrimmed(value))
    .filter((value): value is string => Boolean(value));
  for (const candidate of normalized) {
    if (hasUsableAvatar(candidate)) return candidate;
  }
  return normalized[0] ?? null;
};

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const targetId = (params?.id || "").trim();
    if (!targetId)
      return NextResponse.json(
        { ok: false, error: "MISSING_ID" },
        { status: 400, headers: JSONH },
      );

    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const me = auth?.user?.id || null;
    if (!me)
      return NextResponse.json(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 401, headers: JSONH },
      );

    const { data: conv } = await supabase
      .from("conversations")
      .select("id")
      .or(
        `and(customer_id.eq.${me},pro_id.eq.${targetId}),and(customer_id.eq.${targetId},pro_id.eq.${me})`,
      )
      .limit(1)
      .maybeSingle();
    if (!conv)
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN" },
        { status: 403, headers: JSONH },
      );

    const admin = getAdminSupabase();
    const [{ data: prof }, { data: pro }, { data: proView }] =
      await Promise.all([
        admin
          .from("profiles")
          .select("id, full_name, avatar_url")
          .eq("id", targetId)
          .maybeSingle(),
        admin
          .from("professionals")
          .select(
            "id, full_name, avatar_url, bio, years_experience, rating, city, cities, categories, subcategories",
          )
          .eq("id", targetId)
          .maybeSingle(),
        admin
          .from("professionals_with_profile")
          .select(
            "id, full_name, avatar_url, bio, years_experience, rating, city, cities, categories, subcategories",
          )
          .eq("id", targetId)
          .maybeSingle(),
      ]);

    let authUserName: string | null = null;
    let authUserAvatar: string | null = null;
    try {
      const authResult = await admin.auth.admin.getUserById(targetId);
      const metadata = (authResult.data?.user?.user_metadata ?? null) as Record<
        string,
        unknown
      > | null;
      authUserName =
        asTrimmed(metadata?.full_name) ??
        asTrimmed(metadata?.name) ??
        asTrimmed(authResult.data?.user?.email) ??
        null;
      authUserAvatar =
        asTrimmed(metadata?.avatar_url) ??
        asTrimmed(metadata?.picture) ??
        asTrimmed(metadata?.avatar) ??
        asTrimmed(metadata?.photo_url) ??
        null;
    } catch {
      authUserName = null;
      authUserAvatar = null;
    }

    if (!pro && !prof && !proView)
      return NextResponse.json(
        { ok: false, error: "NOT_FOUND" },
        { status: 404, headers: JSONH },
      );

    const full_name =
      asTrimmed(pro?.full_name) ??
      asTrimmed(proView?.full_name) ??
      asTrimmed(prof?.full_name) ??
      authUserName;
    const avatar_url = pickBestAvatar(
      pro?.avatar_url,
      proView?.avatar_url,
      prof?.avatar_url,
      authUserAvatar,
    );
    const city =
      (typeof pro?.city === "string" ? pro.city : null) ||
      (typeof proView?.city === "string" ? proView.city : null) ||
      null;
    const bio =
      (typeof pro?.bio === "string" ? pro.bio : null) ||
      (typeof proView?.bio === "string" ? proView.bio : null) ||
      null;
    const years_experience =
      typeof pro?.years_experience === "number" &&
      Number.isFinite(pro.years_experience)
        ? pro.years_experience
        : typeof proView?.years_experience === "number" &&
            Number.isFinite(proView.years_experience)
          ? proView.years_experience
          : null;
    const rating =
      typeof pro?.rating === "number" && Number.isFinite(pro.rating)
        ? pro.rating
        : typeof proView?.rating === "number" && Number.isFinite(proView.rating)
          ? proView.rating
          : null;
    const categories = toNames(pro?.categories ?? proView?.categories);
    const subcategories = toNames(pro?.subcategories ?? proView?.subcategories);
    const cities = toNames(pro?.cities ?? proView?.cities);

    return NextResponse.json(
      {
        ok: true,
        data: {
          id: targetId,
          full_name,
          avatar_url,
          bio,
          years_experience,
          rating,
          city,
          cities,
          categories,
          subcategories,
        },
      },
      { status: 200, headers: JSONH },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500, headers: JSONH },
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
