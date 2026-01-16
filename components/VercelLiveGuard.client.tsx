/*
Guard to prevent CLS/perceived footer delay from late-injected Vercel Live/Feedback
overlay assets (vercel.live/_next-live) on scroll. It removes matching iframe/script/link
nodes via a MutationObserver and runs only in production; preview/dev keep the overlay.
Preferred long-term fix: disable Vercel Live/Feedback overlay for production in Vercel
project settings.
*/
"use client";

import { useEffect } from "react";

const vercelEnv =
  process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV || "";
const isProd =
  process.env.NODE_ENV === "production" &&
  (vercelEnv === "" || vercelEnv === "production");

const VERCEL_LIVE_MARKERS = ["vercel.live", "_next-live"];

function hasVercelLiveMarker(value: string | null): boolean {
  if (!value) return false;
  return VERCEL_LIVE_MARKERS.some((marker) => value.includes(marker));
}

function shouldRemove(node: Element): boolean {
  if (!(node instanceof HTMLElement)) return false;
  const attrs = [
    node.getAttribute("src"),
    node.getAttribute("href"),
    node.getAttribute("data-src"),
    node.getAttribute("data-href"),
  ];
  return attrs.some(hasVercelLiveMarker);
}

function removeMatchingNodes(root: Element): boolean {
  let removed = false;

  if (root.matches("iframe, script, link") && shouldRemove(root)) {
    root.remove();
    removed = true;
  }

  root.querySelectorAll("iframe, script, link").forEach((node) => {
    if (shouldRemove(node)) {
      node.remove();
      removed = true;
    }
  });

  return removed;
}

function removeFromMutations(records: MutationRecord[]): boolean {
  let removed = false;
  records.forEach((record) => {
    record.addedNodes.forEach((node) => {
      if (!(node instanceof Element)) return;
      if (removeMatchingNodes(node)) {
        removed = true;
      }
    });
  });
  return removed;
}

export default function VercelLiveGuard() {
  useEffect(() => {
    if (!isProd) return;

    // Prevent CLS from late Vercel Live/Feedback UI injection in production.
    const observer = new MutationObserver((records) => {
      if (removeFromMutations(records)) {
        observer.disconnect();
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    const timeoutId = window.setTimeout(() => {
      observer.disconnect();
    }, 12_000);

    return () => {
      window.clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, []);

  return null;
}
