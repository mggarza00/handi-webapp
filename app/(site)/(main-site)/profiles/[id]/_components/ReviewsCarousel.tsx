import * as React from "react";
import { headers } from "next/headers";

import ReviewsCarouselClient from "./ReviewsCarousel.client";

type ReviewItem = {
  id: string;
  client_name: string | null;
  client_avatar: string | null;
  rating: number;
  comment: string | null;
  created_at: string | null;
};

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

export default async function ReviewsCarousel({ professionalId }: { professionalId: string }) {
  const base = getBaseUrl();
  const res = await fetch(`${base}/api/professionals/${professionalId}/reviews?limit=12`, {
    headers: { "Content-Type": "application/json; charset=utf-8" },
    next: { tags: [`profile:${professionalId}`] },
  });
  const j = await res.json().catch(() => null);
  const initial: ReviewItem[] = res.ok && j?.ok ? (j.data as ReviewItem[]) : [];
  const nextCursor: string | null = res.ok && j?.ok ? (j.nextCursor as string | null) : null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Reseñas de clientes</h3>
      <ReviewsCarouselClient professionalId={professionalId} initial={initial} nextCursor={nextCursor} />
      {!initial.length && <p className="text-sm text-muted-foreground">Aún no hay reseñas.</p>}
    </div>
  );
}

