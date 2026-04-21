import { beforeEach, describe, expect, it, vi } from "vitest";

const getCompletedJobsCountMapMock = vi.fn();

function createQuery(result: { data?: unknown; error?: unknown; count?: number }) {
  const query: {
    or: () => typeof query;
    order: () => typeof query;
    in: () => typeof query;
    eq: () => typeof query;
    range: () => Promise<typeof result>;
    maybeSingle: () => Promise<typeof result>;
    then: (
      resolve: (value: typeof result) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise<unknown>;
  } = {
    or: () => query,
    order: () => query,
    in: () => query,
    eq: () => query,
    range: async () => result,
    maybeSingle: async () => result,
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };

  return query;
}

const publicRows = [
  {
    id: "pro-1",
    full_name: "Ana Pro",
    avatar_url: null,
    headline: "Plomera",
    bio: "Bio",
    rating: 4.8,
    categories: [],
    subcategories: [],
    city: "Monterrey",
  },
  {
    id: "pro-2",
    full_name: "Luis Pro",
    avatar_url: null,
    headline: "Electricista",
    bio: "Bio",
    rating: null,
    categories: [],
    subcategories: [],
    city: "Monterrey",
  },
];

const publicClient = {
  auth: {
    getUser: vi.fn(async () => ({ data: { user: null } })),
  },
  from: vi.fn((table: string) => {
    if (table === "professionals_with_profile") {
      return {
        select: vi.fn(() =>
          createQuery({
            data: publicRows,
            error: null,
          }),
        ),
      };
    }

    if (table === "ratings") {
      return {
        select: vi.fn(() =>
          createQuery({
            data: [],
            error: null,
          }),
        ),
      };
    }

    throw new Error(`Unexpected public table ${table}`);
  }),
};

const adminClient = {
  from: vi.fn((table: string) => {
    if (table === "categories_subcategories") {
      return {
        select: vi.fn(() =>
          createQuery({
            data: [],
            error: null,
          }),
        ),
      };
    }

    if (table === "ratings") {
      return {
        select: vi.fn(() =>
          createQuery({
            data: [],
            error: null,
          }),
        ),
      };
    }

    throw new Error(`Unexpected admin table ${table}`);
  }),
};

vi.mock("@/utils/supabase/server", () => ({
  default: vi.fn(() => publicClient),
}));

vi.mock("@/lib/supabase", () => ({
  createServerClient: vi.fn(() => adminClient),
}));

vi.mock("@/lib/professionals/completed-jobs", () => ({
  getCompletedJobsCountMap: getCompletedJobsCountMapMock,
}));

vi.mock("@/lib/professionals/filter", () => ({
  filterProfessionalsByRequest: (rows: unknown[]) => rows,
  toArray: (value: unknown) => (Array.isArray(value) ? value : []),
  toNames: () => [],
}));

vi.mock("@/lib/professionals/ratings", () => ({
  buildRatingsAggregateMap: () => new Map(),
  resolveProfessionalRating: ({
    legacyRating,
  }: {
    aggregate: unknown;
    legacyRating: number | null;
  }) => legacyRating,
}));

vi.mock("@/lib/request-pro-alerts", () => ({
  clearRequestProAlert: vi.fn(),
  queueRequestProAlert: vi.fn(),
}));

vi.mock("@/lib/_supabase-server", () => ({
  getUserOrThrow: vi.fn(),
}));

vi.mock("@/lib/validators/profiles", () => ({
  ProfileUpsertSchema: {
    safeParse: vi.fn(),
  },
}));

describe("/api/professionals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCompletedJobsCountMapMock.mockResolvedValue(
      new Map<string, number>([["pro-1", 7]]),
    );
  });

  it("returns jobsDone as a number for every professional row", async () => {
    const { GET } = await import("@/app/api/professionals/route");

    const res = await GET(new Request("http://localhost/api/professionals"));
    const body = await res.json();
    const data = Array.isArray(body?.data) ? body.data : [];

    expect(res.status).toBe(200);
    expect(data).toHaveLength(2);
    expect(data[0]?.jobsDone).toBe(7);
    expect(typeof data[0]?.jobsDone).toBe("number");
    expect(data[1]?.jobsDone).toBe(0);
    expect(typeof data[1]?.jobsDone).toBe("number");
  });
});
