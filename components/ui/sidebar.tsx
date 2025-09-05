"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type SidebarContextValue = {
  open: boolean;
  setOpen: (v: boolean) => void;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

function useSidebar() {
  const ctx = React.useContext(SidebarContext);
  // Fallback seguro: evita crash si se usa fuera del provider
  const [fallbackOpen, setFallbackOpen] = React.useState(false);
  return ctx ?? { open: fallbackOpen, setOpen: setFallbackOpen };
}

function SidebarProvider({ children, defaultOpen = false }: { children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen);

  React.useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, []);

  React.useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return <SidebarContext.Provider value={{ open, setOpen }}>{children}</SidebarContext.Provider>;
}

function SidebarTrigger({ className, children, ...props }: React.ComponentProps<"button">) {
  const { setOpen } = useSidebar();
  return (
    <button
      type="button"
      aria-label="Abrir menú"
      onClick={() => setOpen(true)}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background text-foreground shadow-xs hover:bg-accent focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function SidebarBackdrop({ className, ...props }: React.ComponentProps<"div">) {
  const { open, setOpen } = useSidebar();
  if (!open) return null;
  return (
    <div
      aria-hidden
      onClick={() => setOpen(false)}
      className={cn(
        "fixed inset-0 z-[40] md:hidden bg-black/50",
        className,
      )}
      {...props}
    />
  );
}

function Sidebar({ className, children, side = "left", width = 320 }: { className?: string; children: React.ReactNode; side?: "left" | "right"; width?: number }) {
  const { open, setOpen } = useSidebar();
  const sideClass = side === "left" ? "left-0 -translate-x-full data-[state=open]:translate-x-0" : "right-0 translate-x-full data-[state=open]:translate-x-0";

  const [mounted, setMounted] = React.useState(false);
  const portalRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    const el = document.createElement("div");
    portalRef.current = el;
    document.body.appendChild(el);
    setMounted(true);
    return () => {
      if (portalRef.current && portalRef.current.parentNode) {
        portalRef.current.parentNode.removeChild(portalRef.current);
      }
    };
  }, []);

  if (!mounted || !portalRef.current) return null;

  return createPortal(
    <>
      <SidebarBackdrop className="z-[40]" />
      <aside
        role="dialog"
        aria-modal="true"
        data-state={open ? "open" : "closed"}
        className={cn(
          "fixed inset-y-0 z-[60] w-[var(--sidebar-w)] border bg-background shadow-lg transition-transform duration-300 ease-in-out md:hidden",
          sideClass,
          className,
        )}
        style={{
          // @ts-expect-error -- CSS var for width
          "--sidebar-w": `${width}px`,
        }}
      >
        <button
          aria-label="Cerrar menú"
          className="absolute top-4 right-4 inline-flex size-8 items-center justify-center rounded-md hover:bg-accent focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
          onClick={() => setOpen(false)}
        >
          <XIcon className="size-4" />
        </button>
        <div className="flex h-full flex-col overflow-y-auto p-4">{children}</div>
      </aside>
    </>,
    portalRef.current,
  );
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("text-lg font-semibold", className)} {...props} />;
}

function SidebarContent({ className, ...props }: React.ComponentProps<"nav">) {
  return <nav className={cn("flex flex-col gap-1", className)} {...props} />;
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mt-auto flex flex-col gap-2 pt-2", className)} {...props} />;
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("", className)} {...props} />;
}

export {
  SidebarProvider,
  SidebarTrigger,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenuItem,
  useSidebar,
};
