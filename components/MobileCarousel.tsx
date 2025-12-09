"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { animate, type PanInfo } from "motion";
import { motion, useMotionValue, useTransform as motionUseTransform, type MotionValue } from "motion/react";

type Props = React.PropsWithChildren<{
  gap?: number; // px gap between slides
  padding?: number; // horizontal padding inside scroller
  autoplay?: boolean;
  autoplayDelay?: number; // ms
  loop?: boolean;
  className?: string;
  threeD?: boolean; // enable rotateY effect
  showIndicators?: boolean;
  pauseOnHover?: boolean;
}>; 

const SPRING = { type: "spring", stiffness: 300, damping: 30 } as const;
const DRAG_BUFFER = 0; // px
const VELOCITY_THRESHOLD = 500; // px/s

type SlideProps = {
  item: React.ReactNode;
  index: number;
  itemWidth: number;
  trackStep: number;
  threeD: boolean;
  x: MotionValue<number>;
};

function CarouselSlide({ item, index, itemWidth, trackStep, threeD, x }: SlideProps) {
  const inputRange = React.useMemo(
    () => [-(index + 1) * trackStep, -index * trackStep, -(index - 1) * trackStep],
    [index, trackStep],
  );
  const rotateY = motionUseTransform(x, inputRange, [90, 0, -90], { clamp: false });
  return (
    <motion.div
      className="shrink-0 snap-start"
      style={{ width: itemWidth, minWidth: itemWidth, rotateY: threeD ? rotateY : undefined }}
    >
      {item}
    </motion.div>
  );
}

export default function MobileCarousel({
  children,
  gap = 16,
  padding = 16,
  autoplay = false,
  autoplayDelay = 3000,
  loop = false,
  className,
  threeD = true,
  showIndicators = true,
  pauseOnHover = true,
}: Props) {
  const baseItems = useMemo(() => React.Children.toArray(children), [children]);
  const items = baseItems;
  const renderItems = useMemo(() => (loop && items.length > 1 ? [...items, items[0]] : items), [items, loop]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerW, setContainerW] = useState(0);
  const itemW = Math.max(0, containerW - padding * 2);
  const trackStep = itemW + gap;
  const [index, setIndex] = useState(0);
  const x = useMotionValue(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // measure
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setContainerW(el.clientWidth));
    ro.observe(el);
    setContainerW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // animate to index
  useEffect(() => {
    if (isResetting) {
      x.set(-index * trackStep);
      return;
    }
    const controls = animate(x, -index * trackStep, { ...SPRING });
    // handle infinite loop reset when we hit the ghost slide (last duplicate)
    controls.finished.then(() => {
      if (loop && renderItems.length > items.length && index === renderItems.length - 1) {
        setIsResetting(true);
        x.set(0);
        setIndex(0);
        setTimeout(() => setIsResetting(false), 50);
      }
    });
    return controls.stop;
  }, [index, trackStep, x, loop, renderItems.length, items.length, isResetting]);

  // autoplay
  useEffect(() => {
    if (!autoplay || items.length <= 1 || (pauseOnHover && isHovered)) return;
    const t = setInterval(() => {
      setIndex((i) => {
        const last = items.length - 1;
        if (!loop) return Math.min(i + 1, last);
        // loop: move to ghost slide for continuity, then reset on animation complete
        return i >= last ? renderItems.length - 1 : i + 1;
      });
    }, Math.max(1000, autoplayDelay));
    return () => clearInterval(t);
  }, [autoplay, autoplayDelay, items.length, loop, renderItems.length, pauseOnHover, isHovered]);

  const onDragEnd = useCallback(
    (_: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
      const offset = info?.offset?.x ?? 0;
      const velocity = info?.velocity?.x ?? 0;
      if (offset < -DRAG_BUFFER || velocity < -VELOCITY_THRESHOLD) {
        setIndex((i) => {
          const lastReal = items.length - 1;
          if (loop && i === lastReal) return renderItems.length - 1; // ghost
          return Math.min(i + 1, lastReal);
        });
      } else if (offset > DRAG_BUFFER || velocity > VELOCITY_THRESHOLD) {
        setIndex((i) => {
          if (loop && i === 0) return items.length - 1; // jump to last real
          return Math.max(i - 1, 0);
        });
      }
    },
    [items.length, loop, renderItems.length],
  );

  const constraints = loop ? undefined : { left: -trackStep * (renderItems.length - 1), right: 0 };
  const visualIndex = useMemo(() => {
    if (!loop) return Math.min(index, items.length - 1);
    // if pointing to ghost (last), represent as 0
    return index === renderItems.length - 1 ? 0 : index;
  }, [index, items.length, loop, renderItems.length]);

  return (
    <div
      ref={containerRef}
      className={"relative w-full overflow-x-hidden overflow-y-visible pb-6 md:pb-0 " + (className ?? "")}
      onMouseEnter={() => pauseOnHover && setIsHovered(true)}
      onMouseLeave={() => pauseOnHover && setIsHovered(false)}
      onTouchStart={() => pauseOnHover && setIsHovered(true)}
      onTouchEnd={() => pauseOnHover && setIsHovered(false)}
    > 
      <motion.div
        className="flex"
        style={{
          x,
          gap: `${gap}px`,
          padding: `0 ${padding}px`,
          perspective: threeD ? 1000 : undefined,
          // approximate center on current slide
          perspectiveOrigin: threeD ? `${index * trackStep + itemW / 2}px 50%` : undefined,
        }}
        drag="x"
        dragConstraints={constraints}
        onDragEnd={onDragEnd}
        aria-roledescription="carousel"
      >
        {renderItems.map((child, i) => (
          <CarouselSlide
            key={i}
            item={child}
            index={i}
            itemWidth={itemW}
            trackStep={trackStep}
            threeD={threeD}
            x={x}
          />
        ))}
      </motion.div>
      {showIndicators && items.length > 1 ? (
        <div className="mt-3 flex w-full items-center justify-center gap-2">
          {items.map((_, i) => (
            <motion.button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Ir al slide ${i + 1}`}
              className="h-2.5 w-2.5 rounded-full bg-slate-300 disabled:opacity-70"
              animate={{ scale: visualIndex === i ? 1.2 : 1, backgroundColor: visualIndex === i ? '#0f172a' : '#cbd5e1' }}
              transition={{ duration: 0.15 }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
