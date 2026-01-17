import { headers } from "next/headers";

import LandingPage from "./LandingPage";
import { buildCatalogLists, type CatalogRow, type CategoryCard } from "./catalog";

import { buildGreetingText, inferGreetingPreferenceFromName } from "@/lib/greeting";
import { ensureGreetingPreferenceForProfile, extractFirstName } from "@/lib/profile";
import { getAdminSupabase } from "@/lib/supabase/admin";
import getServerClient from "@/lib/supabase/server-client";
import type { Database } from "@/types/supabase";

type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "full_name" | "first_name" | "role" | "avatar_url"
> & {
  gender?: string | null;
  is_client_pro?: boolean | null;
  is_admin?: boolean | null;
  greeting_preference?: "bienvenido" | "bienvenida" | "neutral" | null;
};

type SavedAddress = {
  id: string;
  label: string | null;
  address_line: string;
  address_place_id: string | null;
  lat: number | null;
  lng: number | null;
  last_used_at: string | null;
  times_used?: number | null;
};

export const revalidate = 0;
export const dynamic = "force-dynamic";

const CATALOG_REVALIDATE_SECONDS = 300;
const TOP_CATEGORY_SAMPLE = 2000;

const localeSort = (a: string, b: string) =>
  a.localeCompare(b, "es", { sensitivity: "base" });

function getBaseUrl() {
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || "http";
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (host ? `${proto}://${host}` : "http://localhost:3000")
  );
}

async function getCatalogLists() {
  const origin = getBaseUrl();
  try {
    const res = await fetch(`${origin}/api/catalog/categories`, {
      next: { revalidate: CATALOG_REVALIDATE_SECONDS },
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload?.ok) {
      return { categoryCards: [], subcategories: [] };
    }
    return buildCatalogLists((payload?.data ?? []) as CatalogRow[]);
  } catch (error) {
    console.error("[landing] catalog fetch failed", error);
    return { categoryCards: [], subcategories: [] };
  }
}

async function getTopCategoryCards(
  categoryCards: CategoryCard[],
): Promise<CategoryCard[]> {
  if (!categoryCards.length) return [];
  try {
    const admin = getAdminSupabase();
    const { data, error } = await admin
      .from("requests")
      .select("category, created_at")
      .order("created_at", { ascending: false })
      .limit(TOP_CATEGORY_SAMPLE);
    if (error || !Array.isArray(data)) {
      return categoryCards.slice(0, 8);
    }
    const counts = new Map<string, number>();
    data.forEach((row) => {
      const name = (row as Record<string, unknown>)?.category;
      const clean = (name ?? "").toString().trim();
      if (!clean) return;
      counts.set(clean, (counts.get(clean) || 0) + 1);
    });
    const sorted = [...categoryCards].sort((a, b) => {
      const diff = (counts.get(b.name) || 0) - (counts.get(a.name) || 0);
      if (diff !== 0) return diff;
      return localeSort(a.name, b.name);
    });
    return sorted.slice(0, 8);
  } catch (error) {
    console.error("[landing] top categories failed", error);
    return categoryCards.slice(0, 8);
  }
}

export default async function Page() {
  const supabase = getServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user ?? null;

  let profile: ProfileRow | null = null;
  if (user) {
    const baseSelect =
      "id, full_name, first_name, role, avatar_url, is_client_pro, is_admin";
    const selectWithGreeting = `${baseSelect}, greeting_preference`;

    const fetchProfile = async (select: string) =>
      supabase
        .from("profiles")
        .select(`${select}, gender`)
        .eq("id", user.id)
        .maybeSingle<ProfileRow>();

    const { data, error } = await fetchProfile(selectWithGreeting);
    if (!error && data) {
      profile = data;
    } else {
      const retry = await fetchProfile(baseSelect);
      profile = retry.data ?? null;
    }
  }

  let savedAddresses: SavedAddress[] = [];
  if (user) {
    const { data } = await supabase
      .from("user_saved_addresses")
      .select("id,label,address_line,address_place_id,lat,lng,last_used_at,times_used")
      .eq("user_id", user.id)
      .order("last_used_at", { ascending: false })
      .limit(5);
    savedAddresses = (data || []) as SavedAddress[];
  }

  const fullName =
    profile?.full_name ??
    (user?.user_metadata?.full_name as string | null) ??
    user?.email ??
    null;
  const mappedRole = (() => {
    const role = (profile?.role ?? null) as null | "client" | "pro" | "admin";
    if (role === "pro" || profile?.is_client_pro) return "pro" as const;
    if (role === "admin" || profile?.is_admin) return "admin" as const;
    if (role === "client") return "client" as const;
    return null;
  })();

  const variant = !user
    ? "guest"
    : mappedRole === "pro" || mappedRole === "admin"
      ? "other"
      : "client";
  let greetingText: string | undefined;

  if (variant === "client" && user) {
    const firstName = extractFirstName(
      (profile?.first_name as string | null) ??
        (profile?.full_name as string | null) ??
        (user.user_metadata?.full_name as string | null) ??
        user.email ??
        "",
    );

    const pref = profile
      ? await ensureGreetingPreferenceForProfile(profile as ProfileRow)
      : inferGreetingPreferenceFromName(firstName);
    greetingText = buildGreetingText(pref, firstName);
  }

  const catalogLists = await getCatalogLists();
  const topCategoryCards = await getTopCategoryCards(
    catalogLists.categoryCards,
  );

  return (
    <LandingPage
      variant={variant}
      greetingText={greetingText}
      fullName={fullName}
      savedAddresses={savedAddresses}
      categoryCards={catalogLists.categoryCards}
      subcategories={catalogLists.subcategories}
      topCategoryCards={topCategoryCards}
    />
  );
}
