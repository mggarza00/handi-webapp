type ProfileLookupError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

export type ClientProfileLookupAttempt = {
  lookupKey: "id" | "user_id";
  identifier: string;
  found: boolean;
  error: ProfileLookupError | null;
  selectClause: string;
};

export type ClientProfileLookupRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at?: string | null;
  city?: string | null;
  bio?: string | null;
  is_client_pro?: boolean | null;
  rating?: number | null;
};

type QueryableAdminClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => {
        maybeSingle: <T>() => Promise<{
          data: T | null;
          error: ProfileLookupError | null;
        }>;
      };
    };
  };
};

function isMissingUserIdColumnError(
  error: ProfileLookupError | null | undefined,
) {
  return error?.code === "42703" && (error?.message || "").includes("user_id");
}

export async function resolveClientProfileByAnyId<
  T extends ClientProfileLookupRow,
>(
  admin: QueryableAdminClient,
  identifier: string,
  selectClause: string,
): Promise<{
  profile: T | null;
  lookupKey: "id" | "user_id" | null;
  error: ProfileLookupError | null;
  attempts: ClientProfileLookupAttempt[];
  userIdColumnMissing: boolean;
}> {
  const attempts: ClientProfileLookupAttempt[] = [];
  const byId = await admin
    .from("profiles")
    .select(selectClause)
    .eq("id", identifier)
    .maybeSingle<T>();

  attempts.push({
    lookupKey: "id",
    identifier,
    found: Boolean(byId.data),
    error: byId.error,
    selectClause,
  });

  if (byId.data || byId.error) {
    return {
      profile: byId.data ?? null,
      lookupKey: byId.data ? "id" : null,
      error: byId.error,
      attempts,
      userIdColumnMissing: false,
    };
  }

  const byUserId = await admin
    .from("profiles")
    .select(selectClause)
    .eq("user_id", identifier)
    .maybeSingle<T>();

  attempts.push({
    lookupKey: "user_id",
    identifier,
    found: Boolean(byUserId.data),
    error: byUserId.error,
    selectClause,
  });

  if (isMissingUserIdColumnError(byUserId.error)) {
    return {
      profile: null,
      lookupKey: null,
      error: null,
      attempts,
      userIdColumnMissing: true,
    };
  }

  return {
    profile: byUserId.data ?? null,
    lookupKey: byUserId.data ? "user_id" : null,
    error: byUserId.error,
    attempts,
    userIdColumnMissing: false,
  };
}
