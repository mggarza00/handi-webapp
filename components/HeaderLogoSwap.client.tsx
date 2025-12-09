"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

type Props = {
  href: string;
  className?: string;
  width?: number;
  height?: number;
};

export default function HeaderLogoSwap({
  href,
  className,
  width = 128,
  height = 128,
}: Props) {
  const [overHero, setOverHero] = useState(true);

  useEffect(() => {
    const hero = document.getElementById("hero-client") ?? document.getElementById("hero");
    if (!hero) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setOverHero(entry?.isIntersecting ?? false);
      },
      {
        root: null,
        rootMargin: "-80px 0px 0px 0px",
        threshold: 0,
      },
    );

    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  const logoSrc = overHero ? "/images/LOGO_HEADER_B.png" : "/images/LOGO_HEADER_DB.png";

  return (
    <Link
      href={href}
      className={className}
      aria-label="Handi inicio"
    >
      <Image
        src={logoSrc}
        alt="Handi"
        width={width}
        height={height}
        priority
        className="h-32 w-32 object-contain logo-white"
      />
    </Link>
  );
}
