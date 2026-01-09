import * as React from "react";
import { headers } from "next/headers";

import JobHistoryGridClient from "./JobHistoryGrid.client";

type JobItem = { request_id: string; request_title: string; photos: string[] };

function getBaseUrl() {
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || "http";
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    (host ? `${proto}://${host}` : "http://localhost:3000")
  );
}

export default async function JobHistoryGrid({ professionalId }: { professionalId: string }) {
  const base = getBaseUrl();
  const res = await fetch(`${base}/api/professionals/${professionalId}/jobs?limit=10`, {
    headers: { "Content-Type": "application/json; charset=utf-8" },
    next: { tags: [`profile:${professionalId}`] },
  });
  const j = await res.json().catch(() => null);
  const initial: JobItem[] = res.ok && j?.ok ? (j.data as JobItem[]) : [];
  const nextCursor: string | null = res.ok && j?.ok ? (j.nextCursor as string | null) : null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Trabajos realizados</h3>
      <JobHistoryGridClient professionalId={professionalId} initial={initial} nextCursor={nextCursor} />
      {!initial.length && (
        <p className="text-sm text-muted-foreground">Todavía no hay trabajos publicados.</p>
      )}
    </div>
  );
}

