import { describe, expect, it, vi } from "vitest";

import { getClientData } from "@/lib/clients/get-client-data";

function createQuery(result: {
  data?: unknown;
  error?: { code?: string; message: string } | null;
  count?: number | null;
}) {
  const query: {
    eq: ReturnType<typeof vi.fn>;
    or: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: (
      resolve: (value: typeof result) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise<unknown>;
  } = {
    eq: vi.fn(() => query),
    or: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    in: vi.fn(() => query),
    maybeSingle: vi.fn(async () => result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };

  return query;
}

describe("getClientData", () => {
  it("loads the profile by profiles.id and queries requests by client_id when it differs from created_by", async () => {
    const profileQuery = createQuery({
      data: {
        id: "client-profile-1",
        full_name: "Cliente Uno",
        avatar_url: null,
        created_at: "2026-01-01T00:00:00.000Z",
        city: "Monterrey",
        bio: "Bio",
        is_client_pro: false,
      },
      error: null,
    });
    const recentReviewsQuery = createQuery({
      data: [],
      error: null,
    });
    const aggregateReviewsQuery = createQuery({
      data: [],
      count: 0,
      error: null,
    });
    const requestsQuery = createQuery({
      data: [
        {
          id: "req-1",
          title: "Instalación",
          description: "Detalle",
          created_at: "2026-02-02T00:00:00.000Z",
          status: "active",
          city: "Monterrey",
          category: "Electricidad",
          required_at: "2026-02-03T00:00:00.000Z",
          created_by: "auth-user-1",
          client_id: "client-profile-1",
        },
      ],
      error: null,
    });
    const professionalReviewsQuery = createQuery({
      data: [],
      error: null,
    });

    const reviewQueries = [
      recentReviewsQuery,
      aggregateReviewsQuery,
      professionalReviewsQuery,
    ];

    const admin = {
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn(() => profileQuery),
          };
        }

        if (table === "reviews") {
          const nextQuery = reviewQueries.shift();
          if (!nextQuery) throw new Error("Unexpected reviews query");
          return {
            select: vi.fn(() => nextQuery),
          };
        }

        if (table === "requests") {
          return {
            select: vi.fn(() => requestsQuery),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const data = await getClientData(
      "client-profile-1",
      admin as Parameters<typeof getClientData>[1],
    );

    expect(data.profile?.id).toBe("client-profile-1");
    expect(data.profile?.full_name).toBe("Cliente Uno");
    expect(data.requests).toHaveLength(1);
    expect(data.requests[0]?.id).toBe("req-1");
    expect(requestsQuery.or).toHaveBeenCalledWith(
      "client_id.eq.client-profile-1,created_by.eq.client-profile-1",
    );
  });

  it("falls back to created_by when the requests table does not expose client_id yet", async () => {
    const profileQuery = createQuery({
      data: {
        id: "client-profile-1",
        full_name: "Cliente Uno",
        avatar_url: null,
        created_at: "2026-01-01T00:00:00.000Z",
        city: "Monterrey",
        bio: "Bio",
        is_client_pro: false,
      },
      error: null,
    });
    const recentReviewsQuery = createQuery({
      data: [],
      error: null,
    });
    const aggregateReviewsQuery = createQuery({
      data: [],
      count: 0,
      error: null,
    });
    const requestsWithClientIdQuery = createQuery({
      data: null,
      error: {
        code: "42703",
        message: "column requests.client_id does not exist",
      },
    });
    const fallbackRequestsQuery = createQuery({
      data: [
        {
          id: "req-legacy-1",
          title: "Solicitud legacy",
          description: "Detalle",
          created_at: "2026-02-02T00:00:00.000Z",
          status: "active",
          city: "Monterrey",
          category: "Electricidad",
          required_at: "2026-02-03T00:00:00.000Z",
          created_by: "client-profile-1",
        },
      ],
      error: null,
    });
    const professionalReviewsQuery = createQuery({
      data: [],
      error: null,
    });

    const requestSelects = [requestsWithClientIdQuery, fallbackRequestsQuery];
    const reviewQueries = [
      recentReviewsQuery,
      aggregateReviewsQuery,
      professionalReviewsQuery,
    ];

    const admin = {
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn(() => profileQuery),
          };
        }

        if (table === "reviews") {
          const nextQuery = reviewQueries.shift();
          if (!nextQuery) throw new Error("Unexpected reviews query");
          return {
            select: vi.fn(() => nextQuery),
          };
        }

        if (table === "requests") {
          const nextQuery = requestSelects.shift();
          if (!nextQuery) throw new Error("Unexpected requests query");
          return {
            select: vi.fn(() => nextQuery),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const data = await getClientData(
      "client-profile-1",
      admin as Parameters<typeof getClientData>[1],
    );

    expect(data.requests).toHaveLength(1);
    expect(data.requests[0]?.id).toBe("req-legacy-1");
    expect(requestsWithClientIdQuery.or).toHaveBeenCalledWith(
      "client_id.eq.client-profile-1,created_by.eq.client-profile-1",
    );
    expect(fallbackRequestsQuery.or).toHaveBeenCalledWith(
      "created_by.eq.client-profile-1",
    );
  });

  it("resolves the canonical profile via profiles.user_id and still loads /clients/[id] data", async () => {
    const profileByIdQuery = createQuery({
      data: null,
      error: null,
    });
    const profileByUserIdQuery = createQuery({
      data: {
        id: "client-profile-77",
        full_name: "Cliente Canonico",
        avatar_url: null,
        created_at: "2026-01-01T00:00:00.000Z",
        city: "Monterrey",
        bio: "Bio",
        is_client_pro: false,
      },
      error: null,
    });
    const recentReviewsQuery = createQuery({
      data: [],
      error: null,
    });
    const aggregateReviewsQuery = createQuery({
      data: [],
      count: 0,
      error: null,
    });
    const requestsQuery = createQuery({
      data: [
        {
          id: "req-user-map-1",
          title: "Solicitud mapeada",
          description: "Detalle",
          created_at: "2026-02-02T00:00:00.000Z",
          status: "active",
          city: "Monterrey",
          category: "Electricidad",
          required_at: "2026-02-03T00:00:00.000Z",
          created_by: "auth-user-77",
          client_id: "client-profile-77",
        },
      ],
      error: null,
    });
    const professionalReviewsQuery = createQuery({
      data: [],
      error: null,
    });

    const profileQueries = [profileByIdQuery, profileByUserIdQuery];
    const reviewQueries = [
      recentReviewsQuery,
      aggregateReviewsQuery,
      professionalReviewsQuery,
    ];

    const admin = {
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          const nextQuery = profileQueries.shift();
          if (!nextQuery) throw new Error("Unexpected profiles query");
          return {
            select: vi.fn(() => nextQuery),
          };
        }

        if (table === "reviews") {
          const nextQuery = reviewQueries.shift();
          if (!nextQuery) throw new Error("Unexpected reviews query");
          return {
            select: vi.fn(() => nextQuery),
          };
        }

        if (table === "requests") {
          return {
            select: vi.fn(() => requestsQuery),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const data = await getClientData(
      "auth-user-77",
      admin as Parameters<typeof getClientData>[1],
    );

    expect(data.profile?.id).toBe("client-profile-77");
    expect(data.profile?.full_name).toBe("Cliente Canonico");
    expect(requestsQuery.or).toHaveBeenCalledWith(
      "client_id.eq.client-profile-77,created_by.eq.client-profile-77,created_by.eq.auth-user-77",
    );
    expect(recentReviewsQuery.eq).toHaveBeenCalledWith(
      "client_id",
      "client-profile-77",
    );
  });

  it("loads the client profile even when production schema lacks profiles.city, requests.client_id and reviews.reviewer_role", async () => {
    const profileWithUnsupportedColumnsQuery = createQuery({
      data: null,
      error: {
        code: "42703",
        message: "column profiles.city does not exist",
      },
    });
    const profileLegacyQuery = createQuery({
      data: {
        id: "d188c299-b4c2-4823-b161-7977b1120545",
        full_name: "Cliente Real",
        avatar_url: null,
        created_at: "2026-01-01T00:00:00.000Z",
        is_client_pro: true,
      },
      error: null,
    });
    const recentReviewsQuery = createQuery({
      data: [
        {
          id: "review-1",
          request_id: "req-1",
          rating: 5,
          comment: "Muy buen servicio",
          created_at: "2026-03-01T00:00:00.000Z",
        },
      ],
      error: null,
    });
    const aggregateReviewsQuery = createQuery({
      data: [{ rating: 5 }],
      count: 1,
      error: null,
    });
    const requestsWithClientIdQuery = createQuery({
      data: null,
      error: {
        code: "42703",
        message: "column requests.client_id does not exist",
      },
    });
    const requestsFallbackQuery = createQuery({
      data: [
        {
          id: "req-1",
          title: "Solicitud legacy real",
          description: "Detalle",
          created_at: "2026-02-02T00:00:00.000Z",
          status: "active",
          city: null,
          category: "Plomería",
          required_at: "2026-02-03T00:00:00.000Z",
          created_by: "d188c299-b4c2-4823-b161-7977b1120545",
        },
      ],
      error: null,
    });
    const professionalReviewsWithRoleQuery = createQuery({
      data: null,
      error: {
        code: "42703",
        message: "column reviews.reviewer_role does not exist",
      },
    });
    const professionalReviewsFallbackQuery = createQuery({
      data: [
        {
          id: "review-pro-1",
          request_id: "req-1",
          rating: 5,
          comment: "Muy buen servicio",
          created_at: "2026-03-01T00:00:00.000Z",
          client_id: "d188c299-b4c2-4823-b161-7977b1120545",
        },
      ],
      error: null,
    });

    const profileQueries = [
      profileWithUnsupportedColumnsQuery,
      profileLegacyQuery,
    ];
    const requestsQueries = [requestsWithClientIdQuery, requestsFallbackQuery];
    const reviewQueries = [
      recentReviewsQuery,
      aggregateReviewsQuery,
      professionalReviewsWithRoleQuery,
      professionalReviewsFallbackQuery,
    ];

    const admin = {
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          const nextQuery = profileQueries.shift();
          if (!nextQuery) throw new Error("Unexpected profiles query");
          return {
            select: vi.fn(() => nextQuery),
          };
        }

        if (table === "reviews") {
          const nextQuery = reviewQueries.shift();
          if (!nextQuery) throw new Error("Unexpected reviews query");
          return {
            select: vi.fn(() => nextQuery),
          };
        }

        if (table === "requests") {
          const nextQuery = requestsQueries.shift();
          if (!nextQuery) throw new Error("Unexpected requests query");
          return {
            select: vi.fn(() => nextQuery),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const data = await getClientData(
      "d188c299-b4c2-4823-b161-7977b1120545",
      admin as Parameters<typeof getClientData>[1],
    );

    expect(data.profile?.id).toBe("d188c299-b4c2-4823-b161-7977b1120545");
    expect(data.profile?.full_name).toBe("Cliente Real");
    expect(data.ratingSummary).toEqual({ count: 1, average: 5 });
    expect(data.requests).toHaveLength(1);
    expect(data.requests[0]?.proReview?.id).toBe("review-pro-1");
    expect(requestsFallbackQuery.or).toHaveBeenCalledWith(
      "created_by.eq.d188c299-b4c2-4823-b161-7977b1120545",
    );
    expect(professionalReviewsFallbackQuery.eq).toHaveBeenCalledWith(
      "client_id",
      "d188c299-b4c2-4823-b161-7977b1120545",
    );
  });
});
