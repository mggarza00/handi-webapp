"use client";
import { usePathname } from "next/navigation";

export default function ConditionalMainWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const cls = isAdmin ? "pt-0 pb-16 md:pb-0" : "pt-16 pb-16 md:pb-0";
  return <main className={cls}>{children}</main>;
}

