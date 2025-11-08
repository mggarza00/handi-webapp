"use client";

import React, { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";

type IntrinsicTag = keyof JSX.IntrinsicElements;

type SplitMode = "chars" | "words" | "lines" | `${"chars"|"words"|"lines"},${string}`;

export type SplitTextProps = {
  text: string;
  className?: string;
  delay?: number; // base delay in ms before animation starts
  duration?: number; // seconds
  ease?: string;
  splitType?: SplitMode;
  from?: Record<string, unknown>;
  to?: Record<string, unknown>;
  threshold?: number; // 0..1, maps to viewport % for ScrollTrigger start
  rootMargin?: string; // offset like CSS length (px|em|rem|%)
  textAlign?: React.CSSProperties["textAlign"];
  tag?: IntrinsicTag;
  onLetterAnimationComplete?: () => void;
  manualStart?: boolean; // if true, start on startSignal instead of scroll
  startSignal?: number | boolean; // change to trigger start when manualStart
};

export default function SplitText(
  {
    text,
    className = "",
    delay = 100,
    duration = 0.6,
    ease = "power3.out",
    splitType = "chars",
    from = { opacity: 0, y: 40 },
    to = { opacity: 1, y: 0 },
    threshold = 0.1,
    rootMargin = "-100px",
    textAlign,
    tag = "span",
    onLetterAnimationComplete,
    manualStart = false,
    startSignal,
  }: SplitTextProps,
) {
  const ref = useRef<HTMLElement | null>(null);
  const animationCompletedRef = useRef(false);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    try {
      // Wait for fonts so positions are stable before animating
      const fs = (document as any).fonts;
      if (fs?.status === "loaded") setFontsLoaded(true);
      else if (fs?.ready) fs.ready.then(() => setFontsLoaded(true));
      else setFontsLoaded(true);
    } catch {
      setFontsLoaded(true);
    }
  }, []);

  useGSAP(
    () => {
      if (!fontsLoaded || !ref.current || animationCompletedRef.current) return;
      let tween: any | null = null;

      (async () => {
        try {
          const { gsap } = await import("gsap");
          const { ScrollTrigger } = await import("gsap/ScrollTrigger");
          gsap.registerPlugin(ScrollTrigger);

          const el = ref.current! as any;
          // Clean previous instance if any
          try {
            if (el._rbsplitInstance?.revert) el._rbsplitInstance.revert();
          } catch {}
          el._rbsplitInstance = null;

          // compute ScrollTrigger start from threshold/rootMargin similar to IO
          const startPct = Math.max(0, Math.min(1, threshold ?? 0.1));
          const pct = (1 - startPct) * 100;
          const m = /^(-?\d+(?:\.\d+)?)(px|em|rem|%)?$/.exec(rootMargin || "");
          const mVal = m ? parseFloat(m[1]) : 0;
          const mUnit = m ? m[2] || "px" : "px";
          const sign = mVal === 0 ? "" : mVal < 0 ? `-=${Math.abs(mVal)}${mUnit}` : `+=${mVal}${mUnit}`;
          const start = (`top ${pct}%` + (sign ? sign : "")).trim();

          // Try GSAP SplitText plugin if available
          let SplitCtor: any = null;
          try {
            // Works if plugin is installed (Club GreenSock)
            const mod: any = await import("gsap/SplitText").catch(() => null);
            SplitCtor = mod?.SplitText || mod?.default || null;
          } catch {}

          if (SplitCtor) {
            // Build SplitText instance (lines/words/chars)
            let targets: any[] | undefined;
            const assignTargets = (self: any) => {
              const t = (splitType || "chars").toString();
              if (t.includes("chars") && self.chars?.length) targets = self.chars;
              if (!targets && t.includes("words") && self.words?.length) targets = self.words;
              if (!targets && t.includes("lines") && self.lines?.length) targets = self.lines;
              if (!targets) targets = self.chars || self.words || self.lines || [];
            };

            const splitInstance = new SplitCtor(el, {
              type: splitType,
              smartWrap: true,
              autoSplit: (splitType as string)?.includes("lines"),
              linesClass: "split-line",
              wordsClass: "split-word",
              charsClass: "split-char",
              reduceWhiteSpace: false,
              onSplit: (self: any) => {
                assignTargets(self);
                const toVars: any = {
                  ...(to as any),
                  duration,
                  ease,
                  stagger: Math.max(0, delay) / 1000,
                  onComplete: () => {
                    animationCompletedRef.current = true;
                    onLetterAnimationComplete?.();
                  },
                  willChange: "transform, opacity",
                  force3D: true,
                };
                if (!manualStart) {
                  toVars.scrollTrigger = {
                    trigger: el,
                    start,
                    once: true,
                    fastScrollEnd: true,
                    anticipatePin: 0.4,
                  };
                  gsap.set(el, { visibility: "visible" });
                }
                // set initial
                gsap.set(targets!, from as any);
                // start now if manualStart and startSignal is truthy
                if (manualStart) {
                  if (startSignal) { gsap.set(el, { visibility: "visible" }); tween = gsap.to(targets!, toVars); }
                } else {
                  tween = gsap.to(targets!, toVars);
                }
                return tween;
              },
            });
            el._rbsplitInstance = splitInstance;
          } else {
            // Fallback: manual split into spans (chars/words)
            const original = text;
            el.textContent = "";
            const container = document.createDocumentFragment();
            const mode = (splitType || "chars").toString();
            const tokens = mode.startsWith("words") ? original.split(/(\s+)/) : Array.from(original);
            tokens.forEach((tk) => {
              const isSpace = /\s+/.test(tk);
              const span = document.createElement("span");
              span.textContent = isSpace ? "\u00A0" : tk;
              span.setAttribute(isSpace ? "data-space" : "data-ch", isSpace ? "1" : tk);
              span.className = "inline-block align-baseline";
              container.appendChild(span);
            });
            el.appendChild(container);

            const spans = Array.from(el.querySelectorAll("[data-ch], [data-space]")) as HTMLElement[];
            gsap.set(spans, from as any);
            const toVars2: any = {
              ...(to as any),
              ease,
              duration,
              stagger: 0.035,
              delay: Math.max(0, delay) / 1000,
              onComplete: () => {
                if (!animationCompletedRef.current) {
                  animationCompletedRef.current = true;
                  onLetterAnimationComplete?.();
                }
              },
            };
            if (!manualStart) { toVars2.scrollTrigger = { trigger: el, start, once: true }; gsap.set(el, { visibility: "visible" }); }
            if (manualStart) {
              if (startSignal) { gsap.set(el, { visibility: "visible" }); tween = gsap.to(spans, toVars2); }
            } else {
              tween = gsap.to(spans, toVars2);
            }
          }
        } catch {
          // ignore
        }
      })();

      return () => {
        try {
          // kill triggers tied to this element
          import("gsap/ScrollTrigger").then((m) => {
            const ST: any = m.ScrollTrigger || m.default;
            ST?.getAll?.()?.forEach((st: any) => {
              if ((ref.current && st?.trigger === ref.current) || st?.vars?.trigger === ref.current) st.kill();
            });
          });
          tween?.scrollTrigger?.kill?.();
          tween?.kill?.();
          const el = ref.current as any;
          try { el?._rbsplitInstance?.revert?.(); } catch {}
          if (el) el._rbsplitInstance = null;
        } catch {}
      };
    },
    { dependencies: [fontsLoaded, text, delay, duration, ease, splitType, JSON.stringify(from), JSON.stringify(to), threshold, rootMargin, manualStart, startSignal ? 1 : 0] },
  );

  const commonStyle: React.CSSProperties = {
    overflow: "visible",
    display: (tag === "p" || tag === "div") ? "block" : "inline",
    whiteSpace: "inherit",
    verticalAlign: "baseline",
    willChange: "transform, opacity",
  };
  if (textAlign) commonStyle.textAlign = textAlign;

  const props = { ref: ref as any, className: `split-parent ${className}`.trim(), style: commonStyle };
  return React.createElement(tag, props, text);
}
