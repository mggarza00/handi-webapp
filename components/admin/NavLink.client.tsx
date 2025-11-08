"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export default function NavLink({
  href,
  children,
  className,
  title,
  exact = false,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
  exact?: boolean;
}) {
  const pathname = usePathname() || "";
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      title={title}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-accent",
        active && "bg-accent text-accent-foreground",
        className,
      )}
    >
      {children}
    </Link>
  );
}
