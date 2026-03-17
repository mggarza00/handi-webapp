"use client";

import * as React from "react";

type AvatarThumbProps = {
  src: string | null | undefined;
  alt: string;
  className?: string;
};

export function AvatarThumb({ src, alt, className }: AvatarThumbProps) {
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={`h-16 w-16 rounded border bg-slate-100 ${className || ""}`.trim()}
        aria-label={alt}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`h-16 w-16 rounded border object-cover ${className || ""}`.trim()}
    />
  );
}
