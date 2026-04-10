"use client";

import { usePathname } from "next/navigation";

import MobileClientTabbarButtons from "@/components/mobile-client-tabbar.client";
import type { HeaderRole } from "@/lib/routing/header-active-role";
import { shouldShowMobileClientTabbar } from "@/lib/routing/mobile-tabbar-visibility";

type MobileClientTabBarShellProps = {
  isAuth: boolean;
  effectiveRole: HeaderRole;
  isClientPro: boolean;
  proApply: boolean;
};

export default function MobileClientTabBarShell(
  props: MobileClientTabBarShellProps,
) {
  const pathname = usePathname();
  const shouldShow = shouldShowMobileClientTabbar({
    ...props,
    pathname,
  });

  if (!shouldShow) return null;

  return (
    <div
      id="mobile-client-tabbar"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-neutral-50/80 dark:bg-neutral-900/40 backdrop-blur-md"
    >
      <div className="mx-auto max-w-5xl px-4">
        <MobileClientTabbarButtons />
      </div>
    </div>
  );
}
