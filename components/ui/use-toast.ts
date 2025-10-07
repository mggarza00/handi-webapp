"use client";

// Adapter para unificar API shadcn con `sonner`.
// Uso 1: toast("Título", { description, duration })
// Uso 2: toast({ title, description, duration, action: { label, onClick?, href? } })

import { toast as sonnerToast } from "sonner";

export type ToastAction = {
  label: string;
  onClick?: () => void;
  href?: string;
};

export type ToastOptions = {
  description?: string;
  duration?: number;
  action?: ToastAction;
};

export function toast(title: string, options?: ToastOptions): string | number;
export function toast(config: { title: string; description?: string; duration?: number; action?: ToastAction }): string | number;
export function toast(a: string | { title: string; description?: string; duration?: number; action?: ToastAction }, b?: ToastOptions) {
  const isObj = typeof a === "object" && a !== null;
  const title = isObj ? (a as any).title : (a as string);
  const description = isObj ? (a as any).description : b?.description;
  const duration = isObj ? (a as any).duration : b?.duration;
  const action = (isObj ? (a as any).action : b?.action) as ToastAction | undefined;
  const opts: Record<string, unknown> = {};
  if (description) opts.description = description;
  if (typeof duration === "number") opts.duration = duration;
  if (action && action.label) {
    const handler = () => {
      try {
        if (action.href) window.location.assign(action.href);
        else action.onClick?.();
      } catch {
        /* noop */
      }
    };
    (opts as any).action = { label: action.label, onClick: handler };
  }
  return sonnerToast(title, opts as any);
}
