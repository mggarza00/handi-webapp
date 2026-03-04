"use client";

import { useEffect } from "react";
import confetti from "canvas-confetti";

function fireBurst(particleCount: number, spread: number, scalar = 1) {
  confetti({
    particleCount,
    spread,
    scalar,
    startVelocity: 35,
    gravity: 1.05,
    ticks: 180,
    origin: { x: 0.5, y: 0.2 },
  });
}

export default function ProApplySubmittedConfetti() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let t1 = 0;
    let t2 = 0;
    const raf = window.requestAnimationFrame(() => {
      try {
        fireBurst(80, 70, 1);
        t1 = window.setTimeout(() => fireBurst(55, 55, 0.95), 500);
        t2 = window.setTimeout(() => fireBurst(45, 65, 0.9), 1100);
      } catch {
        // Ignore confetti runtime errors
      }
    });

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  return null;
}
