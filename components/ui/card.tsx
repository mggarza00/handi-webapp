import * as React from "react";
import { cn } from "@/lib/cn";

export function Card({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-soft", className)}>{children}</div>;
}
export function CardHeader({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 border-b border-neutral-200 dark:border-neutral-800", className)}>{children}</div>;
}
export function CardContent({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)}>{children}</div>;
}
