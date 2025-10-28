"use client";
import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export default function MobileClientTabbarButtons() {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const link1Ref = React.useRef<HTMLAnchorElement | null>(null);
  const link2Ref = React.useRef<HTMLAnchorElement | null>(null);
  const icon1Ref = React.useRef<HTMLImageElement | null>(null);
  const icon2Ref = React.useRef<HTMLImageElement | null>(null);
  const label1Ref = React.useRef<HTMLSpanElement | null>(null);
  const label2Ref = React.useRef<HTMLSpanElement | null>(null);
  const [stack, setStack] = React.useState(false);

  const measure = React.useCallback(() => {
    const c = containerRef.current;
    const l1 = link1Ref.current;
    const l2 = link2Ref.current;
    const i1 = icon1Ref.current;
    const i2 = icon2Ref.current;
    const t1 = label1Ref.current;
    const t2 = label2Ref.current;
    if (!c || !l1 || !l2 || !i1 || !i2 || !t1 || !t2) return;

    const needsStack = (link: HTMLElement, icon: HTMLElement, label: HTMLElement) => {
      const cs = window.getComputedStyle(link);
      const pl = parseFloat(cs.paddingLeft || "0") || 0;
      const pr = parseFloat(cs.paddingRight || "0") || 0;
      const gap = parseFloat((cs as any).columnGap || cs.gap || "0") || 0;
      const avail = link.clientWidth - pl - pr - icon.clientWidth - gap;
      const prevWs = (label.style as any).whiteSpace as string | undefined;
      label.style.whiteSpace = "nowrap"; // measure natural single-line width regardless of current mode
      const req = label.scrollWidth;
      if (prevWs) label.style.whiteSpace = prevWs; else label.style.removeProperty("white-space");
      return req > avail + 1; // 1px tolerance
    };

    const s1 = needsStack(l1, i1, t1);
    const s2 = needsStack(l2, i2, t2);
    setStack(s1 || s2);
  }, []);

  React.useEffect(() => {
    const obs: ResizeObserver | null = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    const nodes = [containerRef.current, link1Ref.current, link2Ref.current].filter(Boolean) as Element[];
    nodes.forEach((n) => obs?.observe(n));
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    // Initial measure after mount
    setTimeout(measure, 0);
    return () => {
      try { obs?.disconnect(); } catch {}
      window.removeEventListener("resize", onResize);
    };
  }, [measure]);

  const linkBase = `flex-1 h-full justify-center ${stack ? "flex-col gap-1" : "flex-row gap-2"}`;
  const labelBase = stack ? "text-center whitespace-normal leading-tight text-xs" : "whitespace-nowrap";

  return (
    <div
      ref={containerRef}
      className="flex items-stretch gap-2 h-14"
      style={stack ? { height: "calc(3.5rem * 1.1)" } : undefined}
    >
      <Button asChild variant="ghost" size="lg" className={linkBase + " hover:bg-[#E6F4FF] hover:text-[#11314B]"}>
        <Link href="/requests?mine=1" aria-label="Mis solicitudes" ref={link1Ref}>
          <Image
            ref={icon1Ref}
            src="/images/icono-mis-solicitudes.gif"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8"
          />
          <span ref={label1Ref} className={labelBase}>Mis solicitudes</span>
        </Link>
      </Button>
      <Button asChild variant="ghost" size="lg" className={linkBase + " hover:bg-[#E6F4FF] hover:text-[#11314B]"}>
        <Link href="/requests/new" aria-label="Nueva solicitud" ref={link2Ref}>
          <Image
            ref={icon2Ref}
            src="/images/icono-nueva-solicitud.gif"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8"
          />
          <span ref={label2Ref} className={labelBase}>Nueva solicitud</span>
        </Link>
      </Button>
    </div>
  );
}
