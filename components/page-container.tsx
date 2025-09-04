import * as React from "react";

import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
};

export default function PageContainer({ children, className, contentClassName }: Props) {
  return (
    <main className={cn("mx-auto max-w-5xl px-4 py-10", className)}>
      <div className={cn("max-w-3xl", contentClassName)}>{children}</div>
    </main>
  );
}

