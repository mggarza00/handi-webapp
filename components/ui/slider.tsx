"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

export type SliderProps = React.ComponentProps<typeof SliderPrimitive.Root> & {
  value?: number[];
  defaultValue?: number[];
  onValueChange?: (value: number[]) => void;
};

export const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center",
      className,
    )}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted">
      <SliderPrimitive.Range className="absolute h-full bg-primary" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block size-4 rounded-full border border-primary bg-background shadow hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
    <SliderPrimitive.Thumb className="block size-4 rounded-full border border-primary bg-background shadow hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
  </SliderPrimitive.Root>
));

Slider.displayName = "Slider";
