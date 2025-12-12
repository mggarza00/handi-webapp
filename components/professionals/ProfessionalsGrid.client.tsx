"use client";

import * as React from "react";

import {
  ProfessionalCard,
  normalizeProItem,
} from "@/components/professionals/NearbyCarousel.client";
import type {
  NormalizedPro,
  ProItem,
} from "@/components/professionals/NearbyCarousel.client";

type Props = {
  items: ProItem[];
};

export default function ProfessionalsGrid({ items }: Props) {
  const pros = React.useMemo<NormalizedPro[]>(
    () => (items || []).map((item) => normalizeProItem(item)),
    [items],
  );

  if (!pros.length) return null;

  return (
    <div className="grid grid-cols-1 justify-items-center gap-x-8 gap-y-16 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
      {pros.map((pro) => (
        <ProfessionalCard key={pro.id} pro={pro} />
      ))}
    </div>
  );
}
