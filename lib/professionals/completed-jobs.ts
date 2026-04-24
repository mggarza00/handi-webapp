const COMPLETED_REQUEST_STATUSES = ["completed", "finished", "finalizada"];
const COMPLETED_AGREEMENT_STATUSES = ["completed", "finished", "finalizada"];
const COMPLETED_CALENDAR_STATUSES = ["completed", "finished"];

type RowRecord = Record<string, unknown>;

type CompletedJobsSources = {
  agreements?: RowRecord[] | null;
  requests?: RowRecord[] | null;
  calendarEvents?: RowRecord[] | null;
};

type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => {
      in: (column: string, values: readonly string[]) => {
        in: (column: string, values: readonly string[]) => PromiseLike<{
          data?: RowRecord[] | null;
          error?: { message?: string | null } | null;
        }>;
      };
    };
  };
};

const toTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const addCompletedJob = (
  map: Map<string, Set<string>>,
  professionalId: unknown,
  requestId: unknown,
  fallbackKey: string,
) => {
  const proId = toTrimmedString(professionalId);
  if (!proId) return;
  const jobKey = toTrimmedString(requestId) ?? fallbackKey;
  if (!jobKey) return;
  const jobs = map.get(proId) ?? new Set<string>();
  jobs.add(jobKey);
  map.set(proId, jobs);
};

export function buildCompletedJobsCountMap(
  sources: CompletedJobsSources,
): Map<string, number> {
  const jobsByProfessional = new Map<string, Set<string>>();

  for (const [index, row] of (sources.requests ?? []).entries()) {
    addCompletedJob(
      jobsByProfessional,
      row.professional_id,
      row.id,
      `request:${index}`,
    );
  }

  for (const [index, row] of (sources.agreements ?? []).entries()) {
    addCompletedJob(
      jobsByProfessional,
      row.professional_id,
      row.request_id,
      `agreement:${index}`,
    );
  }

  for (const [index, row] of (sources.calendarEvents ?? []).entries()) {
    addCompletedJob(
      jobsByProfessional,
      row.pro_id,
      row.request_id,
      `calendar:${index}`,
    );
  }

  return new Map(
    Array.from(jobsByProfessional.entries()).map(([professionalId, jobs]) => [
      professionalId,
      jobs.size,
    ]),
  );
}

export async function getCompletedJobsCountMap(
  admin: SupabaseLike,
  professionalIds: string[],
): Promise<Map<string, number>> {
  const ids = professionalIds
    .map((id) => id.trim())
    .filter(Boolean);
  if (!ids.length) return new Map();

  const [requestsResult, agreementsResult, calendarEventsResult] =
    await Promise.all([
      admin
        .from("requests")
        .select("id, professional_id")
        .in("professional_id", ids)
        .in("status", COMPLETED_REQUEST_STATUSES),
      admin
        .from("agreements")
        .select("request_id, professional_id")
        .in("professional_id", ids)
        .in("status", COMPLETED_AGREEMENT_STATUSES),
      admin
        .from("pro_calendar_events")
        .select("request_id, pro_id")
        .in("pro_id", ids)
        .in("status", COMPLETED_CALENDAR_STATUSES),
    ]);

  return buildCompletedJobsCountMap({
    requests: requestsResult?.error ? [] : (requestsResult?.data ?? []),
    agreements: agreementsResult?.error ? [] : (agreementsResult?.data ?? []),
    calendarEvents: calendarEventsResult?.error
      ? []
      : (calendarEventsResult?.data ?? []),
  });
}

export const COMPLETED_JOB_STATUSES = {
  agreements: COMPLETED_AGREEMENT_STATUSES,
  calendarEvents: COMPLETED_CALENDAR_STATUSES,
  requests: COMPLETED_REQUEST_STATUSES,
} as const;
