import * as React from "react";

import StarRating from "@/components/StarRating";

export type ReviewItemProps = {
  stars: number;
  comment?: string;
  createdAt: string;
  clientName?: string;
  clientAvatarUrl?: string;
};

export default function ReviewItem({ stars, comment, createdAt, clientName, clientAvatarUrl }: ReviewItemProps) {
  const d = createdAt ? new Date(createdAt) : null;
  const dateStr = d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : "";
  return (
    <article className="flex gap-3 rounded-lg border p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={clientAvatarUrl || "/avatar.png"}
        alt={clientName || "Cliente"}
        className="h-9 w-9 rounded-full border object-cover"
        loading="lazy"
        decoding="async"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <strong className="text-sm text-slate-900 truncate">{clientName || "Cliente"}</strong>
          <StarRating value={stars} ariaLabel={`Reseña ${stars} de 5`} />
          {dateStr ? <time className="text-xs text-slate-500">{dateStr}</time> : null}
        </div>
        {comment ? <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{comment}</p> : null}
      </div>
    </article>
  );
}
