"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef } from "react";

type LandingHeroTextRevealProps = {
  as?: "div" | "h1" | "p";
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  subtitle?: ReactNode;
  subtitleClassName?: string;
  maxChars?: number;
};

export default function LandingHeroTextReveal({
  as = "div",
  className,
  style,
  children,
  subtitle,
  subtitleClassName,
  maxChars = 160,
}: LandingHeroTextRevealProps) {
  const titleRef = useRef<HTMLElement | null>(null);
  const subtitleRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia?.("(min-width: 768px)").matches) return;

    const countChars = (node: HTMLElement | null) =>
      (node?.textContent || "").length;
    if (countChars(titleRef.current) > maxChars) return;

    const applySplit = (root: HTMLElement | null): HTMLElement[] => {
      if (!root) return [];
      const splitRoot = root as HTMLElement & {
        dataset?: DOMStringMap;
      };
      if (splitRoot.dataset?.heroSplitApplied === "1") {
        return Array.from(root.querySelectorAll<HTMLElement>(".hero-split"));
      }

      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) =>
          node.textContent && node.textContent.trim().length > 0
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT,
      });

      const textNodes: Text[] = [];
      while (walker.nextNode()) {
        textNodes.push(walker.currentNode as Text);
      }

      textNodes.forEach((textNode) => {
        const fragment = document.createDocumentFragment();
        for (const character of Array.from(textNode.textContent || "")) {
          const span = document.createElement("span");
          span.textContent = character === " " ? "\u00A0" : character;
          span.className =
            "hero-split inline-block translate-y-6 opacity-0 align-baseline will-change-transform will-change-opacity";
          fragment.appendChild(span);
        }
        textNode.parentNode?.replaceChild(fragment, textNode);
      });

      if (splitRoot.dataset) {
        splitRoot.dataset.heroSplitApplied = "1";
      }

      return Array.from(root.querySelectorAll<HTMLElement>(".hero-split"));
    };

    const run = async () => {
      const splitChars = applySplit(titleRef.current);
      if (!splitChars.length) return;

      const { gsap } = await import("gsap");
      const subtitleElement = subtitleRef.current;
      if (subtitleElement) {
        gsap.set(subtitleElement, { opacity: 0 });
      }

      const timeline = gsap.timeline();
      timeline.to(splitChars, {
        opacity: 1,
        y: 0,
        ease: "power3.out",
        duration: 0.6,
        stagger: 0.05,
      });

      if (subtitleElement) {
        timeline.to(
          subtitleElement,
          {
            opacity: 1,
            ease: "power2.out",
            duration: 0.8,
          },
          "+=0.05",
        );
      }
    };

    const windowWithIdle = window as Window & {
      requestIdleCallback?: (
        callback: () => void,
        options?: { timeout: number },
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    let idleHandle: number | null = null;
    let timeoutHandle: number | null = null;

    if (windowWithIdle.requestIdleCallback) {
      idleHandle = windowWithIdle.requestIdleCallback(
        () => {
          void run();
        },
        { timeout: 2000 },
      );
    } else {
      timeoutHandle = window.setTimeout(() => {
        void run();
      }, 1000);
    }

    return () => {
      if (idleHandle !== null && windowWithIdle.cancelIdleCallback) {
        windowWithIdle.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle);
      }
    };
  }, [maxChars]);

  return (
    <>
      {as === "h1" ? (
        <h1
          ref={(node) => {
            titleRef.current = node;
          }}
          className={className}
          style={style}
        >
          {children}
        </h1>
      ) : as === "p" ? (
        <p
          ref={(node) => {
            titleRef.current = node;
          }}
          className={className}
          style={style}
        >
          {children}
        </p>
      ) : (
        <div
          ref={(node) => {
            titleRef.current = node;
          }}
          className={className}
          style={style}
        >
          {children}
        </div>
      )}
      {subtitle ? (
        <p
          ref={(node) => {
            subtitleRef.current = node;
          }}
          className={subtitleClassName}
        >
          {subtitle}
        </p>
      ) : null}
    </>
  );
}
