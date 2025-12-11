"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type Props = {
  href: string;
  className?: string;
  width?: number;
  height?: number;
  /** When true, swap logo only on landing (/) while over hero; elsewhere keep default */
  swapOnLanding?: boolean;
};

export default function HeaderLogoSwap({
  href,
  className,
  width = 128,
  height = 128,
  swapOnLanding = false,
}: Props) {
  const pathname = usePathname();
  const enableSwap = useMemo(
    () => swapOnLanding && pathname === "/",
    [swapOnLanding, pathname],
  );
  const [overHero, setOverHero] = useState(true);

  useEffect(() => {
    if (!enableSwap) {
      setOverHero(false);
      return;
    }
    const hero =
      document.getElementById("hero-client") ?? document.getElementById("hero");
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
  }, [enableSwap]);

  const logoSrc =
    enableSwap && overHero
      ? "/images/LOGO_HEADER_B.png"
      : "/images/LOGO_HEADER_DB.png";

  return (
    <Link href={href} className={className} aria-label="Handi inicio">
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
