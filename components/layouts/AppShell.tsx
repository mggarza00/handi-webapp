import type { ReactNode } from "react";
import PublicHeaderController from "@/components/PublicHeaderController.client";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  mainClassName?: string;
  footerWrapperClassName?: string;
};

export default function AppShell({ children, mainClassName, footerWrapperClassName }: Props) {
  const resolvedMainClass = mainClassName ?? "pt-16 pb-16 md:pb-0";
  return (
    <>
      <SiteHeader />
      <PublicHeaderController />
      <main className={cn(resolvedMainClass)}>{children}</main>
      <div className={footerWrapperClassName}>
        <SiteFooter />
      </div>
    </>
  );
}
