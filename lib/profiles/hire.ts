/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from "@supabase/supabase-js";

const REQUEST_OPEN_STATUSES = new Set(["active", "open", "abierta"]);

export type ProfessionalHireProfile = {
  id: string;
  userId: string | null;
  name: string | null;
  cities: string[];
  categories: string[];
  subcategories: string[];
};

export type CompatibleRequestSummary = {
  id: string;
  title: string;
  city: string | null;
  category: string | null;
  subcategory: string | null;
  status: string | null;
  createdAt: string | null;
};

type RequestRow = Record<string, unknown>;

const toTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

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

export const normalizeCompatibilityToken = (value: string): string =>
  value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export const toNames = (value: unknown): string[] => {
  const visit = (input: unknown): string[] => {
    if (Array.isArray(input)) return input.flatMap((item) => visit(item));
    if (typeof input === "string") {
      const trimmed = input.trim();
      if (!trimmed) return [];
      const parsed = parseNamesArray(trimmed);
      if (parsed !== null) return visit(parsed);
      return trimmed.includes(",") ? fromCommaSeparated(trimmed) : [trimmed];
    }
    if (input && typeof input === "object") {
      const record = input as Record<string, unknown>;
      const named =
        toTrimmedString(record.name) ??
        toTrimmedString(record.label) ??
        toTrimmedString(record.value);
      return named ? visit(named) : [];
    }
    return [];
  };

  const seen = new Set<string>();
  const items: string[] = [];
  for (const item of visit(value)) {
    const key = normalizeCompatibilityToken(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }
  return items;
};

export const getRequestSubcategories = (request: RequestRow): string[] => {
  const direct = toTrimmedString(request.subcategory);
  if (direct) return [direct];
  return toNames(request.subcategories);
};

export const isOpenRequestStatus = (status: unknown): boolean => {
  const normalized = toTrimmedString(status);
  if (!normalized) return false;
  return REQUEST_OPEN_STATUSES.has(normalizeCompatibilityToken(normalized));
};

export const isClientRole = ({
  role,
  isClientPro,
}: {
  role: unknown;
  isClientPro?: unknown;
}): boolean => {
  const normalizedRole = toTrimmedString(role);
  if (
    normalizedRole &&
    normalizeCompatibilityToken(normalizedRole) === "client"
  ) {
    return true;
  }
  return isClientPro === true;
};

export const toCompatibleRequestSummary = (
  request: RequestRow,
): CompatibleRequestSummary => {
  const requestSubcategories = getRequestSubcategories(request);
  return {
    id: String(request.id ?? ""),
    title: toTrimmedString(request.title) ?? "Solicitud",
    city: toTrimmedString(request.city),
    category: toTrimmedString(request.category),
    subcategory: requestSubcategories[0] ?? null,
    status: toTrimmedString(request.status),
    createdAt:
      toTrimmedString(request.created_at) ?? toTrimmedString(request.createdAt),
  };
};

export const isRequestCompatibleWithProfessional = ({
  request,
  professional,
}: {
  request: RequestRow;
  professional: ProfessionalHireProfile;
}): boolean => {
  const requestCity = toTrimmedString(request.city);
  const requestCategory = toTrimmedString(request.category);
  if (!requestCity || !requestCategory) return false;

  const normalizedCity = normalizeCompatibilityToken(requestCity);
  const normalizedCategory = normalizeCompatibilityToken(requestCategory);
  const professionalCities = new Set(
    professional.cities.map((city) => normalizeCompatibilityToken(city)),
  );
  const professionalCategories = new Set(
    professional.categories.map((category) =>
      normalizeCompatibilityToken(category),
    ),
  );

  if (
    !professionalCities.has(normalizedCity) ||
    !professionalCategories.has(normalizedCategory)
  ) {
    return false;
  }

  const requestSubcategories = getRequestSubcategories(request);
  if (!requestSubcategories.length || !professional.subcategories.length) {
    return true;
  }

  const professionalSubcategories = new Set(
    professional.subcategories.map((subcategory) =>
      normalizeCompatibilityToken(subcategory),
    ),
  );
  return requestSubcategories.some((subcategory) =>
    professionalSubcategories.has(normalizeCompatibilityToken(subcategory)),
  );
};

export async function fetchProfessionalHireProfile(
  supabase: SupabaseClient<any>,
  profileId: string,
): Promise<ProfessionalHireProfile | null> {
  const client = supabase as any;
  const selectQuery =
    "id, user_id, full_name, city, cities, categories, subcategories";

  const tryMapRow = (
    row: Record<string, unknown> | null,
  ): ProfessionalHireProfile | null => {
    if (!row) return null;
    const resolvedId = toTrimmedString(row.id) ?? profileId;
    const name = toTrimmedString(row.full_name);
    const city = toTrimmedString(row.city);
    const cities = Array.from(
      new Set([...(city ? [city] : []), ...toNames(row.cities)]),
    );
    const categories = toNames(row.categories);
    const subcategories = toNames(row.subcategories);
    return {
      id: resolvedId,
      userId: toTrimmedString(row.user_id),
      name,
      cities,
      categories,
      subcategories,
    };
  };

  const primary = await client
    .from("professionals")
    .select(selectQuery)
    .eq("id", profileId)
    .maybeSingle();
  if (!primary.error && primary.data) {
    return tryMapRow(primary.data as Record<string, unknown>);
  }

  const byUser = await client
    .from("professionals")
    .select(selectQuery)
    .eq("user_id", profileId)
    .maybeSingle();
  if (!byUser.error && byUser.data) {
    return tryMapRow(byUser.data as Record<string, unknown>);
  }

  const fallbackView = await client
    .from("professionals_with_profile")
    .select("id, full_name, city, cities, categories, subcategories")
    .eq("id", profileId)
    .maybeSingle();
  if (!fallbackView.error && fallbackView.data) {
    return tryMapRow(fallbackView.data as Record<string, unknown>);
  }

  return null;
}

export async function fetchClientOpenRequests(
  supabase: SupabaseClient<any>,
  clientId: string,
): Promise<RequestRow[]> {
  const client = supabase as any;
  const response = await client
    .from("requests")
    .select(
      "id, title, city, category, subcategory, subcategories, status, created_at, created_by",
    )
    .eq("created_by", clientId)
    .order("created_at", { ascending: false });

  if (response.error || !Array.isArray(response.data)) {
    return [];
  }

  return (response.data as RequestRow[]).filter((request) =>
    isOpenRequestStatus(request.status),
  );
}

export async function getCompatibleHireRequests(args: {
  supabase: SupabaseClient<any>;
  clientId: string;
  professional: ProfessionalHireProfile;
}): Promise<CompatibleRequestSummary[]> {
  const requests = await fetchClientOpenRequests(args.supabase, args.clientId);
  return requests
    .filter((request) =>
      isRequestCompatibleWithProfessional({
        request,
        professional: args.professional,
      }),
    )
    .map((request) => toCompatibleRequestSummary(request));
}
