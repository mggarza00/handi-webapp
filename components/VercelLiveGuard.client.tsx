"use client";

import { useEffect } from "react";

const isProd =
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PUBLIC_VERCEL_ENV === "production";

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

function removeVercelLiveNodes() {
  const nodes = document.querySelectorAll("iframe, script, link");
  nodes.forEach((node) => {
    if (shouldRemove(node)) {
      node.remove();
    }
  });
}

export default function VercelLiveGuard() {
  useEffect(() => {
    if (!isProd) return;

    // Prevent CLS from late Vercel Live/Feedback UI injection in production.
    removeVercelLiveNodes();
    const observer = new MutationObserver(() => removeVercelLiveNodes());
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, []);

  return null;
}
