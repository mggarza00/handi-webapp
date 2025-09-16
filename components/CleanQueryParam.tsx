"use client";
import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function CleanQueryParam({ keys }: { keys: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  useEffect(() => {
    if (!sp || !pathname) return;
    const params = new URLSearchParams(sp.toString());
    let changed = false;
    keys.forEach((k) => {
      if (params.has(k)) {
        params.delete(k);
        changed = true;
      }
    });
    if (changed) {
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }, [keys, pathname, router, sp]);
  return null;
}
