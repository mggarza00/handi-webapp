import type { ReactNode } from "react";
import AppShell from "@/components/layouts/AppShell";

export default function LandingLayout({ children }: { children: ReactNode }) {
  return <AppShell mainClassName="pt-0 pb-16 md:pb-0">{children}</AppShell>;
}
