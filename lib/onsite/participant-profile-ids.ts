import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";

type ProfileLookupRow = {
  id?: string | null;
};

type ResolveParticipantProfileIdsInput = {
  professionalAuthUserId?: string | null;
  clientAuthUserId?: string | null;
};

type ResolveParticipantProfileIdsResult = {
  professionalProfileId: string | null;
  clientProfileId: string | null;
  missingAuthUserIds: string[];
};

function normalizeId(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function resolveParticipantProfileIdsFromRows(
  input: ResolveParticipantProfileIdsInput,
  rows: ProfileLookupRow[] | null | undefined,
): ResolveParticipantProfileIdsResult {
  const professionalAuthUserId = normalizeId(input.professionalAuthUserId);
  const clientAuthUserId = normalizeId(input.clientAuthUserId);
  const profileIds = new Set(
    Array.isArray(rows)
      ? rows
          .map((row) => normalizeId(row?.id))
          .filter((value): value is string => Boolean(value))
      : [],
  );

  const professionalProfileId =
    professionalAuthUserId && profileIds.has(professionalAuthUserId)
      ? professionalAuthUserId
      : null;
  const clientProfileId =
    clientAuthUserId && profileIds.has(clientAuthUserId)
      ? clientAuthUserId
      : null;

  const missingAuthUserIds = [
    professionalAuthUserId && !professionalProfileId
      ? professionalAuthUserId
      : null,
    clientAuthUserId && !clientProfileId ? clientAuthUserId : null,
  ].filter((value): value is string => Boolean(value));

  return {
    professionalProfileId,
    clientProfileId,
    missingAuthUserIds,
  };
}

export async function resolveParticipantProfileIds(
  admin: SupabaseClient<Database>,
  input: ResolveParticipantProfileIdsInput,
): Promise<ResolveParticipantProfileIdsResult> {
  const requestedIds = [
    normalizeId(input.professionalAuthUserId),
    normalizeId(input.clientAuthUserId),
  ].filter(
    (value, index, list): value is string =>
      Boolean(value) && list.indexOf(value) === index,
  );

  if (!requestedIds.length) {
    return {
      professionalProfileId: null,
      clientProfileId: null,
      missingAuthUserIds: [],
    };
  }

  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .in("id", requestedIds);

  if (error) {
    throw new Error(error.message || "PROFILE_LOOKUP_FAILED");
  }

  return resolveParticipantProfileIdsFromRows(
    input,
    data as ProfileLookupRow[],
  );
}
