"use client";
import * as React from "react";

type Props = {
  src?: string | null;
  alt?: string;
  className?: string;
  sizeClass?: string; // tailwind size class e.g., "size-9"
  border?: boolean;
};

export default function AvatarWithSkeleton({ src, alt = "", className = "", sizeClass = "size-9", border = true }: Props) {
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState(false);
  const showImg = Boolean(src && !error);
  const common = `${sizeClass} rounded-full object-cover ${border ? "border" : ""}`.trim();

  React.useEffect(() => {
    setLoaded(false);
    setError(false);
  }, [src]);

  // Safety: if the image never fires onLoad/onError (e.g., CORS/network oddities), fallback after timeout
  React.useEffect(() => {
    if (!showImg || loaded || error) return;
    const t = window.setTimeout(() => {
      setError(true);
      setLoaded(true);
    }, 2500);
    return () => window.clearTimeout(t);
  }, [showImg, loaded, error]);

  return (
    <div className={`relative ${sizeClass} shrink-0`} aria-busy={!loaded && showImg}>
      {!loaded && (
        <div className={`pointer-events-none absolute inset-0 rounded-full bg-neutral-200 animate-pulse`} aria-hidden />
      )}
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src as string}
          alt={alt}
          className={`${common} ${!loaded ? "opacity-0" : "opacity-100"} transition-opacity duration-200 ${className}`}
          onLoad={() => setLoaded(true)}
          onError={() => { setError(true); setLoaded(true); }}
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
        />
      ) : (
        <div className={`${common} flex items-center justify-center bg-neutral-200 text-neutral-600 ${className}`}>
          {getInitials(alt)}
        </div>
      )}
    </div>
  );
}

function getInitials(text?: string): string {
  const t = (text || '').trim();
  if (!t) return '?';
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0][0] || '';
    const last = parts[parts.length - 1][0] || '';
    return (first + last).toUpperCase();
  }
  // Single word: take first two letters
  const w = parts[0];
  const a = (w?.[0] || '').toUpperCase();
  const b = (w?.[1] || '').toUpperCase();
  return (a + b) || (a || '?');
}
