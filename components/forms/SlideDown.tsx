"use client";
import * as React from "react";

import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  children: React.ReactNode;
  id?: string;
  className?: string;
};

export default function SlideDown({ open, children, id, className }: Props) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [maxH, setMaxH] = React.useState<string>(open ? "none" : "0px");

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      // Temporarily set maxHeight to none to measure full height
      el.style.maxHeight = "none";
      const h = el.scrollHeight;
      return h;
    };
    if (open) {
      const h = measure();
      setMaxH(`${h}px`);
      // After transition ends, remove maxHeight to allow intrinsic layout
      const onEnd = () => setMaxH("none");
      el.addEventListener("transitionend", onEnd, { once: true });
    } else {
      const h = el.scrollHeight;
      // Set from current height to 0 to animate collapse
      setMaxH(`${h}px`);
      requestAnimationFrame(() => setMaxH("0px"));
    }
  }, [open, children]);

  return (
    <div
      id={id}
      aria-hidden={!open}
      className={cn(
        "overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out",
        open ? "opacity-100" : "opacity-0",
        className,
      )}
      style={{ maxHeight: maxH }}
    >
      <div ref={ref}>{children}</div>
    </div>
  );
}
