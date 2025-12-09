"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { SidebarTrigger } from "@/components/ui/sidebar";

export default function Topbar() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();
  useEffect(() => {
    let seq: string[] = [];
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }
      if (e.key.toLowerCase() === "g") {
        seq = ["g"];
        setTimeout(() => (seq = []), 400);
        return;
      }
      if (seq[0] === "g" && e.key.toLowerCase() === "r") {
        e.preventDefault();
        router.push("/admin/requests");
        seq = [];
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
  return (
    <div className="sticky top-16 z-20 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <SidebarTrigger className="md:hidden" />
        <div className="text-sm font-semibold opacity-70">Homaid Admin</div>
        <div className="ml-auto">
          <input ref={inputRef} type="search" placeholder="Buscar..." className="h-9 w-64 rounded-md border bg-background px-3 text-sm" />
        </div>
      </div>
    </div>
  );
}
