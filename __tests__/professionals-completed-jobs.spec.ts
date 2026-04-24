import { describe, expect, it } from "vitest";

import {
  buildCompletedJobsCountMap,
  COMPLETED_JOB_STATUSES,
} from "@/lib/professionals/completed-jobs";

describe("professional completed jobs aggregation", () => {
  it("dedupes completed jobs across requests, agreements, and calendar events", () => {
    const map = buildCompletedJobsCountMap({
      requests: [
        { id: "req-1", professional_id: "pro-1" },
        { id: "req-2", professional_id: "pro-1" },
      ],
      agreements: [
        { request_id: "req-2", professional_id: "pro-1" },
        { request_id: "req-3", professional_id: "pro-1" },
      ],
      calendarEvents: [
        { request_id: "req-3", pro_id: "pro-1" },
        { request_id: "req-4", pro_id: "pro-1" },
        { request_id: "req-5", pro_id: "pro-2" },
      ],
    });

    expect(map.get("pro-1")).toBe(4);
    expect(map.get("pro-2")).toBe(1);
  });

  it("exposes the same completed-status catalogs used by the list endpoint", () => {
    expect(COMPLETED_JOB_STATUSES.requests).toEqual([
      "completed",
      "finished",
      "finalizada",
    ]);
    expect(COMPLETED_JOB_STATUSES.agreements).toEqual([
      "completed",
      "finished",
      "finalizada",
    ]);
    expect(COMPLETED_JOB_STATUSES.calendarEvents).toEqual([
      "completed",
      "finished",
    ]);
  });
});
