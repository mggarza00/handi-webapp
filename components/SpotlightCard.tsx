"use client";
import React, { useRef } from "react";

type SpotlightCardProps = {
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
  style?: React.CSSProperties;
};

export default function SpotlightCard({
  children,
  className = "",
  spotlightColor = "rgba(255, 255, 255, 0.25)",
  style,
}: SpotlightCardProps) {
  const divRef = useRef<HTMLDivElement | null>(null);

  const setVars = (x: number, y: number) => {
    const el = divRef.current;
    if (!el) return;
    el.style.setProperty("--mouse-x", `${x}px`);
    el.style.setProperty("--mouse-y", `${y}px`);
    el.style.setProperty("--spotlight-color", spotlightColor);
  };

  const handleMouseMove: React.MouseEventHandler<HTMLDivElement> = (e) => {
    const el = divRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setVars(x, y);
  };

  const handleTouchMove: React.TouchEventHandler<HTMLDivElement> = (e) => {
    const el = divRef.current;
    if (!el) return;
    const t = e.touches?.[0];
    if (!t) return;
    const rect = el.getBoundingClientRect();
    const x = t.clientX - rect.left;
    const y = t.clientY - rect.top;
    setVars(x, y);
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
      className={`card-spotlight ${className}`.trim()}
      style={style}
    >
      {children}
    </div>
  );
}

