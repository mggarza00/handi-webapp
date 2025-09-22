"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({
  className,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-2", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-4",
        month: "space-y-2",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "space-x-1 flex items-center",
        nav_button:
          "inline-flex h-7 w-7 items-center justify-center rounded-md border bg-transparent p-0 text-sm shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "relative h-9 w-9 text-center text-sm focus-within:relative focus-within:z-20",
        day: "inline-flex h-9 w-9 items-center justify-center rounded-md border border-transparent p-0 font-normal aria-selected:bg-primary aria-selected:text-primary-foreground hover:bg-accent hover:text-accent-foreground",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside: "text-muted-foreground opacity-50",
        day_disabled: "text-muted-foreground opacity-50",
      }}
      // Use default navigation icons to keep type compatibility
      {...props}
    />
  );
}

export type SingleCalendarProps = Omit<
  CalendarProps,
  "mode" | "selected" | "onSelect"
> & {
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
};

export function SingleCalendar(props: SingleCalendarProps) {
  const { selected, onSelect, ...rest } = props;
  return (
    <Calendar mode="single" selected={selected} onSelect={onSelect} {...rest} />
  );
}
