"use client";
import Image from "next/image";
import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="w-full border-b bg-white px-4 py-2 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-2">
        <Image
          src="/handee-logo.png"
          alt="Handee"
          width={120}
          height={40}
          priority
        />
      </Link>
      <nav>
        {/* enlaces extra si quieres */}
      </nav>
    </header>
  );
}
