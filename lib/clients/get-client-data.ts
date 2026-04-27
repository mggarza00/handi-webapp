import { normalizeClientProfileId } from "@/lib/clients/client-profile-link";
import {
  resolveClientProfileByAnyId,
  type ClientProfileLookupAttempt,
} from "@/lib/clients/resolve-client-profile";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";

export type ClientPublicProfile = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "full_name" | "avatar_url" | "created_at" | "city" | "bio" | "is_client_pro"
> & { id: string };

export type ReviewLite = Pick<
  Database["public"]["Tables"]["reviews"]["Row"],
  "id" | "rating" | "comment" | "created_at"
> & { request_id?: string };

export type ClientRequestLite = Pick<
  Database["public"]["Tables"]["requests"]["Row"],
  | "id"
  | "title"
  | "description"
  | "created_at"
  | "status"
  | "city"
  | "category"
  | "required_at"
>;

export type ClientData = {
  profile: ClientPublicProfile | null;
  ratingSummary: { count: number; average: number | null };
  recentReviews: Array<ReviewLite & { request_title?: string | null }>;
  requests: Array<ClientRequestLite & { proReview?: ReviewLite | null }>;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string | null;
  city: string | null;
  bio: string | null;
  is_client_pro: boolean | null;
};

type RequestRow = {
  id: string;
  title: string | null;
  description: string | null;
  created_at: string | null;
  status: string | null;
  city: string | null;
  category: string | null;
  required_at: string | null;
};

type ReviewRow = {
  id: string;
  request_id: string | null;
  rating: number | null;
  comment: string | null;
  created_at: string | null;
};

type AdminClient = ReturnType<typeof getAdminSupabase>;
type SupabaseLikeError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};
type AuthAdminUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};
type ProfileLookupResult = Awaited<
  ReturnType<typeof resolveClientProfileByAnyId<ProfileRow>>
>;
type ProfileSelectVariant = {
  name: "full" | "legacy" | "minimal";
  select: string;
};

const EMPTY_CLIENT_DATA: ClientData = {
  profile: null,
  ratingSummary: { count: 0, average: null },
  recentReviews: [],
  requests: [],
};
const DEBUG_CLIENT_PROFILE = process.env.DEBUG_CLIENT_PROFILE === "1";
const PROFILE_SELECT_VARIANTS: ProfileSelectVariant[] = [
  {
    name: "full",
    select: "id, full_name, avatar_url, created_at, city, bio, is_client_pro",
  },
  {
    name: "legacy",
    select: "id, full_name, avatar_url, created_at, is_client_pro",
  },
  {
    name: "minimal",
    select: "id, full_name, avatar_url, created_at",
  },
];

function serializeSupabaseError(error: unknown): SupabaseLikeError | null {
  if (!error || typeof error !== "object") return null;
  const errorLike = error as Record<string, unknown>;
  return {
    code: typeof errorLike.code === "string" ? errorLike.code : null,
    message: typeof errorLike.message === "string" ? errorLike.message : null,
    details: typeof errorLike.details === "string" ? errorLike.details : null,
    hint: typeof errorLike.hint === "string" ? errorLike.hint : null,
  };
}

function debugClientProfile(message: string, meta: Record<string, unknown>) {
  if (!DEBUG_CLIENT_PROFILE) return;
  console.log(`[clients/debug] ${message}`, meta);
}

function logClientDataIssue(
  level: "warn" | "error",
  message: string,
  meta: Record<string, unknown>,
) {
  console[level](`[clients/get-client-data] ${message}`, meta);
}

function isMissingColumnError(error: unknown, column: string): boolean {
  const serialized = serializeSupabaseError(error);
  return (
    serialized?.code === "42703" && (serialized.message ?? "").includes(column)
  );
}

function isMissingClientIdColumnError(error: unknown): boolean {
  return isMissingColumnError(error, "client_id");
}

function isMissingReviewerRoleColumnError(error: unknown): boolean {
  return isMissingColumnError(error, "reviewer_role");
}

function isMissingProfileColumnError(error: unknown): boolean {
  const serialized = serializeSupabaseError(error);
  if (serialized?.code !== "42703") return false;
  const message = serialized.message ?? "";
  return (
    message.includes("profiles.city") ||
    message.includes("profiles.bio") ||
    message.includes("profiles.is_client_pro")
  );
}

function logProfileLookupAttempts(
  clientId: string,
  variant: ProfileSelectVariant,
  attempts: ClientProfileLookupAttempt[],
) {
  for (const attempt of attempts) {
    debugClientProfile("profile lookup attempt", {
      clientId,
      lookupKey: attempt.lookupKey,
      selectVariant: variant.name,
      selectClause: attempt.selectClause,
      found: attempt.found,
      error: serializeSupabaseError(attempt.error),
    });
  }
}

async function resolveClientProfile(
  admin: AdminClient,
  clientId: string,
): Promise<
  ProfileLookupResult & { selectVariant: ProfileSelectVariant["name"] }
> {
  let lastResult: ProfileLookupResult | null = null;
  let lastVariant: ProfileSelectVariant["name"] = "full";

  for (const variant of PROFILE_SELECT_VARIANTS) {
    const result = await resolveClientProfileByAnyId<ProfileRow>(
      admin,
      clientId,
      variant.select,
    );
    logProfileLookupAttempts(clientId, variant, result.attempts);

    if (!isMissingProfileColumnError(result.error)) {
      return { ...result, selectVariant: variant.name };
    }

    debugClientProfile("profile lookup retrying with narrower select", {
      clientId,
      failedVariant: variant.name,
      error: serializeSupabaseError(result.error),
    });

    lastResult = result;
    lastVariant = variant.name;
  }

  return {
    ...(lastResult ?? {
      profile: null,
      lookupKey: null,
      error: null,
      attempts: [],
      userIdColumnMissing: false,
    }),
    selectVariant: lastVariant,
  };
}

async function ensureProfileForAuthUser(
  admin: AdminClient,
  clientId: string,
): Promise<boolean> {
  const authAdmin = (
    admin as unknown as {
      auth?: {
        admin?: {
          getUserById?: (id: string) => Promise<{
            data?: { user?: AuthAdminUser | null } | null;
            error?: SupabaseLikeError | null;
          }>;
        };
      };
    }
  ).auth?.admin;

  if (!authAdmin?.getUserById) {
    debugClientProfile("auth admin unavailable for ensure profile", {
      clientId,
    });
    return false;
  }

  const authResult = await authAdmin.getUserById(clientId);
  debugClientProfile("auth user lookup", {
    clientId,
    exists: Boolean(authResult.data?.user),
    error: serializeSupabaseError(authResult.error),
  });

  const user = authResult.data?.user ?? null;
  if (authResult.error || !user) return false;

  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : null;

  const insertResponse = await (
    admin as unknown as {
      from: (table: string) => {
        insert: (
          payload: Record<string, unknown>,
        ) => Promise<{ error: SupabaseLikeError | null }>;
      };
    }
  )
    .from("profiles")
    .insert({
      id: user.id,
      email: user.email ?? null,
      full_name: fullName,
    });

  if (insertResponse.error && insertResponse.error.code !== "23505") {
    logClientDataIssue("warn", "profile ensure failed", {
      clientId,
      error: serializeSupabaseError(insertResponse.error),
    });
    return false;
  }

  debugClientProfile("profile ensured from auth user", {
    clientId,
    inserted: !insertResponse.error,
    duplicate: insertResponse.error?.code === "23505",
  });

  return true;
}

async function fetchClientRequests(
  admin: AdminClient,
  clientId: string,
  rawClientId: string,
) {
  const createdByFilter =
    clientId === rawClientId
      ? `created_by.eq.${clientId}`
      : `created_by.eq.${clientId},created_by.eq.${rawClientId}`;
  const primary = await admin
    .from("requests")
    .select(
      "id, title, description, created_at, status, city, category, required_at",
    )
    .or(`client_id.eq.${clientId},${createdByFilter}`)
    .order("created_at", { ascending: false });

  debugClientProfile("requests query by client_id/created_by", {
    clientId,
    rawClientId,
    filter: `client_id.eq.${clientId},${createdByFilter}`,
    error: serializeSupabaseError(primary.error),
  });

  if (!isMissingClientIdColumnError(primary.error)) {
    return primary;
  }

  const fallback = await admin
    .from("requests")
    .select(
      "id, title, description, created_at, status, city, category, required_at",
    )
    .or(createdByFilter)
    .order("created_at", { ascending: false });

  debugClientProfile("requests fallback to created_by", {
    clientId,
    rawClientId,
    filter: createdByFilter,
    error: serializeSupabaseError(fallback.error),
  });

  return fallback;
}

async function fetchProfessionalReviews(
  admin: AdminClient,
  canonicalClientProfileId: string,
  requestIds: string[],
) {
  const primary = await admin
    .from("reviews")
    .select(
      "id, request_id, rating, comment, created_at, reviewer_role, client_id",
    )
    .eq("client_id", canonicalClientProfileId)
    .eq("reviewer_role", "pro")
    .in("request_id", requestIds);

  debugClientProfile("professional reviews query", {
    clientId: canonicalClientProfileId,
    lookup: "reviews.client_id + reviews.reviewer_role",
    error: serializeSupabaseError(primary.error),
  });

  if (!isMissingReviewerRoleColumnError(primary.error)) {
    return primary;
  }

  const fallback = await admin
    .from("reviews")
    .select("id, request_id, rating, comment, created_at, client_id")
    .eq("client_id", canonicalClientProfileId)
    .in("request_id", requestIds);

  debugClientProfile("professional reviews fallback without reviewer_role", {
    clientId: canonicalClientProfileId,
    lookup: "reviews.client_id",
    error: serializeSupabaseError(fallback.error),
  });

  return fallback;
}

function getSettledResult<
  T extends { error?: { message?: string | null } | null },
>(label: string, clientId: string, result: PromiseSettledResult<T>): T | null {
  if (result.status === "rejected") {
    logClientDataIssue("warn", `${label} failed`, {
      clientId,
      reason:
        result.reason instanceof Error ? result.reason.message : "unknown",
    });
    return null;
  }

  if (result.value.error) {
    logClientDataIssue("warn", `${label} failed`, {
      clientId,
      reason: result.value.error.message ?? "unknown",
    });
    return null;
  }

  return result.value;
}

export async function getClientData(
  clientId: string,
  admin?: AdminClient,
): Promise<ClientData> {
  let adminClient: AdminClient;
  try {
    adminClient = admin ?? getAdminSupabase();
  } catch (error) {
    logClientDataIssue("error", "admin supabase initialization failed", {
      clientId,
      hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      hasServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      error:
        error instanceof Error ? error.message : "unknown admin init failure",
    });
    throw error;
  }

  const normalizedClientId = normalizeClientProfileId(clientId);
  debugClientProfile("client page lookup start", {
    rawClientId: clientId,
    normalizedClientId,
    hasServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  });

  if (!normalizedClientId) {
    logClientDataIssue("warn", "invalid client id", { clientId });
    return EMPTY_CLIENT_DATA;
  }

  let profileResolution = await resolveClientProfile(
    adminClient,
    normalizedClientId,
  );

  if (!profileResolution.profile) {
    const ensured = await ensureProfileForAuthUser(
      adminClient,
      normalizedClientId,
    );
    if (ensured) {
      profileResolution = await resolveClientProfile(
        adminClient,
        normalizedClientId,
      );
    }
  }

  const {
    profile: profileRow,
    error: profileError,
    lookupKey,
  } = profileResolution;
  const canonicalClientProfileId = profileRow?.id ?? normalizedClientId;

  debugClientProfile("resolveClientProfile result", {
    rawClientId: clientId,
    normalizedClientId,
    canonicalClientProfileId,
    found: Boolean(profileRow),
    lookupKey,
    selectVariant: profileResolution.selectVariant,
    userIdColumnMissing: profileResolution.userIdColumnMissing,
    error: serializeSupabaseError(profileError),
  });

  if (profileError) {
    logClientDataIssue("error", "profile lookup failed", {
      clientId: normalizedClientId,
      error: serializeSupabaseError(profileError),
    });
  } else if (!profileRow) {
    logClientDataIssue("warn", "profile not found", {
      clientId: normalizedClientId,
      userIdColumnMissing: profileResolution.userIdColumnMissing,
    });
  } else if (lookupKey === "user_id") {
    logClientDataIssue("warn", "profile resolved via user_id fallback", {
      clientId: normalizedClientId,
      profileId: canonicalClientProfileId,
    });
  }

  const [recentReviewsResult, ratingAggregateResult, requestsResult] =
    await Promise.allSettled([
      adminClient
        .from("reviews")
        .select("id, request_id, rating, comment, created_at")
        .eq("client_id", canonicalClientProfileId)
        .order("created_at", { ascending: false })
        .limit(5),
      adminClient
        .from("reviews")
        .select("rating", { count: "exact", head: false })
        .eq("client_id", canonicalClientProfileId),
      fetchClientRequests(
        adminClient,
        canonicalClientProfileId,
        normalizedClientId,
      ),
    ]);

  const recentReviewsQuery = getSettledResult(
    "recent reviews lookup",
    normalizedClientId,
    recentReviewsResult,
  );
  const ratingAggregateQuery = getSettledResult(
    "rating aggregate lookup",
    normalizedClientId,
    ratingAggregateResult,
  );
  const requestsQuery = getSettledResult(
    "requests lookup",
    normalizedClientId,
    requestsResult,
  );

  const count = (ratingAggregateQuery?.count as number | null) ?? 0;
  let average: number | null = null;
  if (count > 0 && Array.isArray(ratingAggregateQuery?.data)) {
    const nums = (ratingAggregateQuery.data as Array<{ rating: number | null }>)
      .map((row) => (typeof row.rating === "number" ? row.rating : null))
      .filter((value): value is number => value != null);
    if (nums.length > 0) {
      const sum = nums.reduce((acc, value) => acc + value, 0);
      average = sum / nums.length;
    }
  }

  const requestRows = (requestsQuery?.data ?? []) as unknown as RequestRow[];
  const requests: ClientRequestLite[] = requestRows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    created_at: row.created_at,
    status: row.status,
    city: row.city,
    category: row.category,
    required_at: row.required_at,
  }));

  const proReviewsByRequestId = new Map<string, ReviewLite>();
  if (requests.length > 0) {
    const requestIds = requests.map((request) => request.id);
    const { data: proReviews, error: proReviewsError } =
      await fetchProfessionalReviews(
        adminClient,
        canonicalClientProfileId,
        requestIds,
      );

    if (proReviewsError) {
      logClientDataIssue("warn", "professional reviews lookup failed", {
        clientId: normalizedClientId,
        error: serializeSupabaseError(proReviewsError),
      });
    }

    const proReviewRows = (proReviews ?? []) as unknown as ReviewRow[];
    for (const review of proReviewRows) {
      if (!review.request_id) continue;
      proReviewsByRequestId.set(review.request_id, {
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        created_at: review.created_at,
        request_id: review.request_id,
      });
    }
  }

  const requestsWithReview = requests.map((request) => ({
    ...request,
    proReview: proReviewsByRequestId.get(String(request.id)) ?? null,
  }));

  const titleByRequestId = new Map<string, string>();
  for (const request of requests) {
    titleByRequestId.set(
      String(request.id),
      String(request.title || "Solicitud"),
    );
  }

  const recentReviewRows = (recentReviewsQuery?.data ??
    []) as unknown as ReviewRow[];

  return {
    profile: profileRow
      ? {
          id: profileRow.id,
          full_name: profileRow.full_name,
          avatar_url: profileRow.avatar_url,
          created_at: profileRow.created_at,
          city: profileRow.city,
          bio: profileRow.bio,
          is_client_pro: profileRow.is_client_pro,
        }
      : null,
    ratingSummary: { count, average },
    recentReviews: recentReviewRows.map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      created_at: review.created_at,
      request_id: review.request_id || undefined,
      request_title: review.request_id
        ? (titleByRequestId.get(review.request_id) ?? null)
        : null,
    })),
    requests: requestsWithReview,
  };
}
