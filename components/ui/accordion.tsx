"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

type AccordionType = "single" | "multiple";

type AccordionContextValue = {
  openItems: string[];
  toggleItem: (value: string) => void;
  type: AccordionType;
};

const AccordionContext = React.createContext<AccordionContextValue | null>(
  null,
);

type AccordionProps = {
  children: React.ReactNode;
  className?: string;
  type?: AccordionType;
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
};

export function Accordion({
  children,
  className,
  type = "multiple",
  value,
  defaultValue = [],
  onValueChange,
}: AccordionProps) {
  const [internalValue, setInternalValue] =
    React.useState<string[]>(defaultValue);
  const currentValue = value ?? internalValue;

  const toggleItem = React.useCallback(
    (item: string) => {
      const next =
        type === "single"
          ? currentValue.includes(item)
            ? []
            : [item]
          : currentValue.includes(item)
            ? currentValue.filter((entry) => entry !== item)
            : [...currentValue, item];

      if (!value) {
        setInternalValue(next);
      }
      onValueChange?.(next);
    },
    [currentValue, onValueChange, type, value],
  );

  const ctx = React.useMemo<AccordionContextValue>(
    () => ({
      openItems: currentValue,
      toggleItem,
      type,
    }),
    [currentValue, toggleItem, type],
  );

  return (
    <div
      className={cn(
        "divide-y rounded-2xl border bg-card text-card-foreground shadow-sm",
        className,
      )}
    >
      <AccordionContext.Provider value={ctx}>
        {children}
      </AccordionContext.Provider>
    </div>
  );
}

type AccordionItemProps = {
  id?: string;
  value: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function AccordionItem({
  id,
  value,
  title,
  description,
  badge,
  actions,
  children,
  className,
}: AccordionItemProps) {
  const ctx = React.useContext(AccordionContext);
  if (!ctx) {
    throw new Error("AccordionItem must be used within <Accordion>");
  }

  const isOpen = ctx.openItems.includes(value);

  return (
    <div id={id} className={cn("group", className)}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => ctx.toggleItem(value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            ctx.toggleItem(value);
          }
        }}
        className="flex w-full items-start gap-4 px-4 py-4 text-left transition hover:bg-muted/40"
        aria-expanded={isOpen}
        aria-controls={`${value}-content`}
      >
        <div className="flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold leading-tight">
              {title}
            </span>
            {badge ? (
              <span className="text-xs text-muted-foreground">{badge}</span>
            ) : null}
          </div>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex items-center gap-2">{actions}</div>
        ) : null}
        <ChevronDown
          className={cn(
            "mt-1 h-4 w-4 text-muted-foreground transition-transform duration-200",
            isOpen ? "rotate-180" : "",
          )}
          aria-hidden
        />
      </div>
      <div
        id={`${value}-content`}
        role="region"
        aria-labelledby={id || value}
        className={cn(
          "grid overflow-hidden transition-[grid-template-rows] duration-200 ease-out",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden px-4 pb-5">{children}</div>
      </div>
    </div>
  );
}
