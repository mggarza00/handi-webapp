"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

const OneTap = dynamic(() => import("./OneTap"), { ssr: false });

export default function OneTapMount() {
  const pathname = usePathname();
  if (pathname !== "/") return null;
  return <OneTap />;
}
