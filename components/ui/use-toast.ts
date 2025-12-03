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

type ToastConfig = { title: string } & ToastOptions;

type InternalToastOptions = {
  description?: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
};

export function toast(title: string, options?: ToastOptions): string | number;
export function toast(config: ToastConfig): string | number;
export function toast(arg1: string | ToastConfig, arg2?: ToastOptions): string | number {
  const config: ToastConfig = typeof arg1 === "string" ? { title: arg1, ...arg2 } : arg1;
  const opts: InternalToastOptions = {};
  if (config.description) opts.description = config.description;
  if (typeof config.duration === "number") opts.duration = config.duration;
  if (config.action?.label) {
    const handler = () => {
      try {
        if (config.action?.href) window.location.assign(config.action.href);
        else config.action?.onClick?.();
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.error("[toast.action]", error);
        }
      }
    };
    opts.action = { label: config.action.label, onClick: handler };
  }
  return sonnerToast(config.title, opts);
}
