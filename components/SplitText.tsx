"use client";

import React, { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";

type SplitHostElement = HTMLElement & { _rbsplitInstance?: SplitPluginInstance };
type SplitPluginInstance = {
  chars?: HTMLElement[];
  words?: HTMLElement[];
  lines?: HTMLElement[];
  revert?: () => void;
};
type SplitTextConstructor = new (element: Element, options?: Record<string, unknown>) => SplitPluginInstance;
type TweenVars = Record<string, unknown>;
type TweenLike = {
  kill?: () => void;
  scrollTrigger?: {
    kill?: () => void;
  };
};
type ScrollTriggerInstance = {
  getAll?: () => Array<{ kill?: () => void }>;
};
type ScrollTriggerModule = {
  ScrollTrigger?: ScrollTriggerInstance;
  default?: ScrollTriggerInstance;
};
type GsapModule = {
  gsap: {
    registerPlugin?: (plugin: unknown) => void;
    to: (targets: HTMLElement[] | HTMLElement, vars: TweenVars) => TweenLike;
  };
};

const isProd = process.env.NODE_ENV === "production";
const logSplitError = (scope: string, error: unknown) => {
  if (isProd) return;
  // eslint-disable-next-line no-console
  console.error(`[SplitText:${scope}]`, error);
};

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
    from = { opacity: 0, y: 40 } satisfies TweenVars,
    to = { opacity: 1, y: 0 } satisfies TweenVars,
    threshold = 0.1,
    rootMargin = "-100px",
    textAlign,
    tag = "span",
    onLetterAnimationComplete,
    manualStart = false,
    startSignal,
  }: SplitTextProps,
) {
  const ref = useRef<SplitHostElement | null>(null);
  const animationCompletedRef = useRef(false);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    try {
      const fonts = document.fonts;
      if (fonts?.status === "loaded") setFontsLoaded(true);
      else if (fonts?.ready) fonts.ready.then(() => setFontsLoaded(true));
      else setFontsLoaded(true);
    } catch (error) {
      logSplitError("fonts", error);
      setFontsLoaded(true);
    }
  }, []);

  useGSAP(
    () => {
      if (!fontsLoaded || !ref.current || animationCompletedRef.current) return;

      let tween: TweenLike | null = null;
      let scrollTriggerInstance: ScrollTriggerInstance | null = null;

      (async () => {
        try {
          const [gsapModule, scrollTriggerModule] = (await Promise.all([
            import("gsap"),
            import("gsap/ScrollTrigger"),
          ])) as [GsapModule, ScrollTriggerModule];
          const { gsap } = gsapModule;
          const scrollTriggerPlugin =
            scrollTriggerModule.ScrollTrigger ?? scrollTriggerModule.default ?? null;
          scrollTriggerInstance = scrollTriggerPlugin;
          if (scrollTriggerPlugin && typeof gsap.registerPlugin === "function") {
            gsap.registerPlugin(scrollTriggerPlugin);
          }

          const el = ref.current;
          if (!el) return;

          const startPct = Math.max(0, Math.min(1, threshold ?? 0.1));
          const pct = (1 - startPct) * 100;
          const marginMatch = /^(-?\d+(?:\.\d+)?)(px|em|rem|%)?$/.exec(rootMargin || "");
          const marginValue = marginMatch ? parseFloat(marginMatch[1]) : 0;
          const marginUnit = marginMatch ? marginMatch[2] || "px" : "px";
          const marginSign =
            marginValue === 0 ? "" : marginValue < 0 ? `-=${Math.abs(marginValue)}${marginUnit}` : `+=${marginValue}${marginUnit}`;
          const start = (`top ${pct}%` + (marginSign ? marginSign : "")).trim();

          const splitPluginModule = await import("gsap/SplitText").catch(() => null);
          const SplitCtor = (splitPluginModule?.SplitText ?? splitPluginModule?.default ?? null) as SplitTextConstructor | null;

          const fromVars: TweenVars = from;
          const toVarsBase: TweenVars = to;

          if (SplitCtor) {
            let targets: HTMLElement[] = [];
            const assignTargets = (instance: SplitPluginInstance) => {
              const preferred = (splitType || "chars").toString();
              if (preferred.includes("chars") && instance.chars?.length) targets = instance.chars;
              if (!targets.length && preferred.includes("words") && instance.words?.length) targets = instance.words;
              if (!targets.length && preferred.includes("lines") && instance.lines?.length) targets = instance.lines;
              if (!targets.length) {
                targets = instance.chars || instance.words || instance.lines || [];
              }
            };

            const splitInstance = new SplitCtor(el, {
              type: splitType,
              smartWrap: true,
              autoSplit: (splitType || "chars").toString().includes("lines"),
              linesClass: "split-line",
              wordsClass: "split-word",
              charsClass: "split-char",
              reduceWhiteSpace: false,
              onSplit: (instance: SplitPluginInstance) => {
                assignTargets(instance);
                const toVars: TweenVars = {
                  ...toVarsBase,
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
                gsap.set(targets, fromVars);
                if (manualStart) {
                  if (startSignal) {
                    gsap.set(el, { visibility: "visible" });
                    tween = gsap.to(targets, toVars);
                  }
                } else {
                  tween = gsap.to(targets, toVars);
                }
                return tween;
              },
            });
            el._rbsplitInstance = splitInstance;
          } else {
            const original = text;
            el.textContent = "";
            const container = document.createDocumentFragment();
            const mode = (splitType || "chars").toString();
            const tokens = mode.startsWith("words") ? original.split(/(\s+)/) : Array.from(original);
            tokens.forEach((token) => {
              const isSpace = /\s+/.test(token);
              const span = document.createElement("span");
              span.textContent = isSpace ? "\u00A0" : token;
              span.setAttribute(isSpace ? "data-space" : "data-ch", isSpace ? "1" : token);
              span.className = "inline-block align-baseline";
              container.appendChild(span);
            });
            el.appendChild(container);

            const spans = Array.from(el.querySelectorAll("[data-ch], [data-space]")) as HTMLElement[];
            gsap.set(spans, fromVars);
            const toVars: TweenVars = {
              ...toVarsBase,
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
            if (!manualStart) {
              toVars.scrollTrigger = { trigger: el, start, once: true };
              gsap.set(el, { visibility: "visible" });
            }
            if (manualStart) {
              if (startSignal) {
                gsap.set(el, { visibility: "visible" });
                tween = gsap.to(spans, toVars);
              }
            } else {
              tween = gsap.to(spans, toVars);
            }
          }
        } catch (error) {
          logSplitError("gsap-run", error);
        }
      })();

      return () => {
        try {
          scrollTriggerInstance?.getAll?.()?.forEach((trigger) => {
            const matchesCurrent =
              !!ref.current &&
              (trigger?.trigger === ref.current || trigger?.vars?.trigger === ref.current);
            if (matchesCurrent) {
              trigger.kill?.();
            }
          });
          tween?.scrollTrigger?.kill?.();
          tween?.kill?.();
          const el = ref.current;
          el?._rbsplitInstance?.revert?.();
          if (el) el._rbsplitInstance = undefined;
        } catch (error) {
          logSplitError("cleanup", error);
        }
      };
    },
    { dependencies: [fontsLoaded, text, delay, duration, ease, splitType, JSON.stringify(from), JSON.stringify(to), threshold, rootMargin, manualStart, startSignal ? 1 : 0] },
  );  const commonStyle: React.CSSProperties = {
    overflow: "visible",
    display: (tag === "p" || tag === "div") ? "block" : "inline",
    whiteSpace: "inherit",
    verticalAlign: "baseline",
    willChange: "transform, opacity",
  };
  if (textAlign) commonStyle.textAlign = textAlign;

  return React.createElement(tag, { ref, className: `split-parent ${className}`.trim(), style: commonStyle }, text);
}

