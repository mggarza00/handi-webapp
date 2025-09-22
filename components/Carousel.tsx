"use client";
import * as React from "react";

export type CarouselProps = React.PropsWithChildren<{
  className?: string;
}>;

export default function Carousel({ className, children }: CarouselProps) {
  return (
    <div className={(className ?? "") + " flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-3 pb-2"}>
      {children}
    </div>
  );
}

