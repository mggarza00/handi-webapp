"use client";
import * as React from "react";
import Link from "next/link";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import CreateRequestButton from "@/components/requests/CreateRequestButton";

export default function MobileClientTabbarButtons() {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const link1Ref = React.useRef<HTMLAnchorElement | null>(null);
  const link2Ref = React.useRef<HTMLButtonElement | null>(null);
  const icon1Ref = React.useRef<HTMLImageElement | null>(null);
  const icon2Ref = React.useRef<HTMLImageElement | null>(null);
  const label1Ref = React.useRef<HTMLSpanElement | null>(null);
  const label2Ref = React.useRef<HTMLSpanElement | null>(null);
  const [stack, setStack] = React.useState(false);
  const prevStackRef = React.useRef(false);
  const rafRef = React.useRef<number | null>(null);
  const resizeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const measure = React.useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const l1 = link1Ref.current;
      const l2 = link2Ref.current;
      const i1 = icon1Ref.current;
      const i2 = icon2Ref.current;
      const t1 = label1Ref.current;
      const t2 = label2Ref.current;
      if (!l1 || !l2 || !i1 || !i2 || !t1 || !t2) return;

      const measureLink = (link: HTMLElement, icon: HTMLElement, label: HTMLElement) => {
        const cs = window.getComputedStyle(link);
        const pl = parseFloat(cs.paddingLeft || "0") || 0;
        const pr = parseFloat(cs.paddingRight || "0") || 0;
        const gap = parseFloat(cs.columnGap || cs.gap || "0") || 0;
        const avail = Math.round(link.clientWidth - pl - pr - icon.clientWidth - gap);
        const previousWhiteSpace = label.style.whiteSpace || "";
        label.style.whiteSpace = "nowrap";
        const req = Math.round(label.scrollWidth);
        if (previousWhiteSpace) {
          label.style.whiteSpace = previousWhiteSpace;
        } else {
          label.style.removeProperty("white-space");
        }
        return { avail, req };
      };

      const m1 = measureLink(l1, i1, t1);
      const m2 = measureLink(l2, i2, t2);

      const margin = 8; // hysteresis in px to avoid oscillation
      const prev = prevStackRef.current;

      // Decide with hysteresis: require stronger condition to toggle state
      const wantsStack = (m1.req > m1.avail + margin) || (m2.req > m2.avail + margin);
      const wantsUnstack = (m1.req <= m1.avail - margin) && (m2.req <= m2.avail - margin);

      let next = prev;
      if (!prev && wantsStack) next = true;
      if (prev && wantsUnstack) next = false;

      if (next !== prev) {
        prevStackRef.current = next;
        setStack(next);
      } else {
        // Ensure state and ref stay aligned
        if (stack !== prev) setStack(prev);
      }
    });
  }, [stack]);

  React.useEffect(() => {
    // Use window resize + orientation change with light debounce to avoid RO loops
    const onResize = () => {
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(measure, 50);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    // Initial measure after mount and after fonts load
    setTimeout(measure, 0);
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts?.ready) {
      fonts.ready
        .then(() => setTimeout(measure, 0))
        .catch(() => undefined);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [measure]);

  const linkBase = `flex-1 h-full justify-center ${stack ? "flex-col gap-1" : "flex-row gap-2"}`;
  const labelBase = stack ? "text-center whitespace-normal leading-tight text-xs" : "whitespace-nowrap";

  return (
    <div
      ref={containerRef}
      className="flex items-stretch gap-2 h-[72px]"
      style={stack ? { height: "calc(72px * 1.1)" } : undefined}
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
      <CreateRequestButton
        ref={link2Ref}
        variant="ghost"
        size="lg"
        className={linkBase + " hover:bg-[#E6F4FF] hover:text-[#11314B]"}
        aria-label="Nueva solicitud"
      >
        <Image
          ref={icon2Ref}
          src="/images/icono-nueva-solicitud.gif"
          alt=""
          width={32}
          height={32}
          className="h-8 w-8"
        />
        <span ref={label2Ref} className={labelBase}>Nueva solicitud</span>
      </CreateRequestButton>
    </div>
  );
}
