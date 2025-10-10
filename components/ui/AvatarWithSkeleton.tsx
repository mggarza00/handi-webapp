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
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
        />
      ) : (
        <div className={`${common} flex items-center justify-center bg-neutral-200 text-neutral-600 ${className}`}>
          {(alt || " ").trim().charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );
}
