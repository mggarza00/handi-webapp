import type { ReactNode } from "react";

import AppShell from "@/components/layouts/AppShell";

export default function MainSiteLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
