"use client";
import { usePathname } from "next/navigation";
import SiteFooter from "@/components/site-footer";

export default function ConditionalFooter() {
  const pathname = usePathname() || "";
  const isMensajes = pathname === "/mensajes" || pathname.startsWith("/mensajes/");
  const wrapperClass = isMensajes ? "hidden md:block" : undefined;
  return (
    <div className={wrapperClass}>
      <SiteFooter />
    </div>
  );
}

