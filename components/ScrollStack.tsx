"use client";
import { useLayoutEffect, useRef, useCallback, useState } from "react";
import Lenis, { type LenisOptions } from "lenis";

export const ScrollStackItem = ({ children, itemClassName = "" }: { children: React.ReactNode; itemClassName?: string }) => (
  <div className={`scroll-stack-card ${itemClassName}`.trim()}>{children}</div>
);

type ScrollStackProps = {
  children: React.ReactNode;
  className?: string;
  itemDistance?: number;
  itemScale?: number;
  itemStackDistance?: number;
  stackPosition?: string | number;
  scaleEndPosition?: string | number;
  baseScale?: number;
  scaleDuration?: number;
  rotationAmount?: number;
  blurAmount?: number;
  useWindowScroll?: boolean;
  onStackComplete?: () => void;
  /** When true, shrink container to only fit the stacked cards (window scroll mode). */
  fitToStack?: boolean;
  /** Extra space after the stack for animation end when in fitToStack mode (px). */
  endSpacerPx?: number;
};

type LenisController = {
  destroy?: () => void;
};

type TransformSnapshot = {
  translateY: number;
  scale: number;
  rotation: number;
  blur: number;
};

export default function ScrollStack({
  children,
  className = "",
  itemDistance = 100,
  itemScale = 0.03,
  itemStackDistance = 30,
  stackPosition = "20%",
  scaleEndPosition = "10%",
  baseScale = 0.85,
  scaleDuration = 0.5,
  rotationAmount = 0,
  blurAmount = 0,
  useWindowScroll = false,
  onStackComplete,
  fitToStack = false,
  endSpacerPx,
}: ScrollStackProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const stackCompletedRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const lenisRef = useRef<Lenis | LenisController | null>(null);
  const cardsRef = useRef<HTMLElement[]>([]);
  const lastTransformsRef = useRef<Map<number, TransformSnapshot>>(new Map());
  const isUpdatingRef = useRef(false);
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);

  const calculateProgress = useCallback((scrollTop: number, start: number, end: number) => {
    if (scrollTop < start) return 0;
    if (scrollTop > end) return 1;
    return (scrollTop - start) / (end - start);
  }, []);

  const parsePercentage = useCallback((value: string | number, containerHeight: number) => {
    if (typeof value === "string" && value.includes("%")) {
      return (parseFloat(value) / 100) * containerHeight;
    }
    return Number(value);
  }, []);

  const getScrollData = useCallback(() => {
    if (useWindowScroll) {
      return {
        scrollTop: window.scrollY,
        containerHeight: window.innerHeight,
        scrollContainer: document.documentElement,
      };
    } else {
      const scroller = scrollerRef.current!;
      return {
        scrollTop: scroller.scrollTop,
        containerHeight: scroller.clientHeight,
        scrollContainer: scroller,
      };
    }
  }, [useWindowScroll]);

  const getElementOffset = useCallback(
    (element: Element) => {
      if (useWindowScroll) {
        const rect = element.getBoundingClientRect();
        return rect.top + window.scrollY;
      } else {
        return (element as HTMLElement).offsetTop;
      }
    },
    [useWindowScroll],
  );

  const updateCardTransforms = useCallback(() => {
    if (!cardsRef.current.length || isUpdatingRef.current) return;
    isUpdatingRef.current = true;

    const { scrollTop, containerHeight } = getScrollData();
    const stackPositionPx = parsePercentage(stackPosition, containerHeight);
    const scaleEndPositionPx = parsePercentage(scaleEndPosition, containerHeight);

    const endElement = useWindowScroll
      ? (document.querySelector('.scroll-stack-end') as HTMLElement | null)
      : (scrollerRef.current?.querySelector('.scroll-stack-end') as HTMLElement | null);

    const endElementTop = endElement ? getElementOffset(endElement) : 0;

    cardsRef.current.forEach((card, i) => {
      const cardTop = getElementOffset(card);
      const sign = (fitToStack && useWindowScroll) ? -1 : 1;
      const offset = itemStackDistance * i * sign;
      const triggerStart = cardTop - stackPositionPx - offset;
      const triggerEnd = cardTop - scaleEndPositionPx;
      const pinStart = cardTop - stackPositionPx - offset;
      const pinEnd = endElementTop - containerHeight / 2;

      const scaleProgress = calculateProgress(scrollTop, triggerStart, triggerEnd);
      const targetScale = baseScale + i * itemScale;
      const scale = 1 - scaleProgress * (1 - targetScale);
      const rotation = rotationAmount ? i * rotationAmount * scaleProgress : 0;

      let blur = 0;
      if (blurAmount) {
        let topCardIndex = 0;
        for (let j = 0; j < cardsRef.current.length; j++) {
          const jCardTop = getElementOffset(cardsRef.current[j]);
          const jOffset = itemStackDistance * j * sign;
          const jTriggerStart = jCardTop - stackPositionPx - jOffset;
          if (scrollTop >= jTriggerStart) topCardIndex = j;
        }
        if (i < topCardIndex) {
          const depthInStack = topCardIndex - i;
          blur = Math.max(0, depthInStack * blurAmount);
        }
      }

      let translateY = 0;
      const isPinned = scrollTop >= pinStart && scrollTop <= pinEnd;
      if (isPinned) {
        translateY = scrollTop - cardTop + stackPositionPx + itemStackDistance * i;
      } else if (scrollTop > pinEnd) {
        translateY = pinEnd - cardTop + stackPositionPx + itemStackDistance * i;
      } else if (fitToStack && useWindowScroll) {
        // Before entering the stack, keep cards visually offset to show the stack
        translateY = itemStackDistance * i;
      }

      const newTransform: TransformSnapshot = {
        translateY: Math.round(translateY * 100) / 100,
        scale: Math.round(scale * 1000) / 1000,
        rotation: Math.round(rotation * 100) / 100,
        blur: Math.round(blur * 100) / 100,
      };

      const lastTransform = lastTransformsRef.current.get(i);
      const hasChanged =
        !lastTransform ||
        Math.abs(lastTransform.translateY - newTransform.translateY) > 0.1 ||
        Math.abs(lastTransform.scale - newTransform.scale) > 0.001 ||
        Math.abs(lastTransform.rotation - newTransform.rotation) > 0.1 ||
        Math.abs(lastTransform.blur - newTransform.blur) > 0.1;

      if (hasChanged) {
        const transform = `translate3d(0, ${newTransform.translateY}px, 0) scale(${newTransform.scale}) rotate(${newTransform.rotation}deg)`;
        const filter = newTransform.blur > 0 ? `blur(${newTransform.blur}px)` : '';
        card.style.transform = transform;
        card.style.filter = filter;
        lastTransformsRef.current.set(i, newTransform);
      }

      if (i === cardsRef.current.length - 1) {
        const isInView = scrollTop >= pinStart && scrollTop <= pinEnd;
        if (isInView && !stackCompletedRef.current) {
          stackCompletedRef.current = true;
          onStackComplete?.();
        } else if (!isInView && stackCompletedRef.current) {
          stackCompletedRef.current = false;
        }
      }
    });

    isUpdatingRef.current = false;
  }, [
    itemScale,
    itemStackDistance,
    stackPosition,
    scaleEndPosition,
    baseScale,
    rotationAmount,
    blurAmount,
    useWindowScroll,
    fitToStack,
    onStackComplete,
    calculateProgress,
    parsePercentage,
    getScrollData,
    getElementOffset,
  ]);

  const handleScroll = useCallback(() => {
    updateCardTransforms();
  }, [updateCardTransforms]);

  const measureHeights = useCallback(() => {
    if (!fitToStack || !useWindowScroll) return;
    const cards = cardsRef.current;
    if (!cards || cards.length === 0) return;
    let maxH = 0;
    cards.forEach((c) => {
      const h = (c as HTMLElement).offsetHeight;
      if (h > maxH) maxH = h;
    });
    const extra = itemStackDistance * (cards.length - 1);
    const target = Math.max(0, Math.round(maxH + extra));
    if (!measuredHeight || Math.abs(measuredHeight - target) > 1) {
      setMeasuredHeight(target);
    }
  }, [fitToStack, useWindowScroll, itemStackDistance, measuredHeight]);

  const setupLenis = useCallback(() => {
    if (useWindowScroll) {
      // Use native window scroll listeners to avoid conflicts / jitter
      const onScroll = () => handleScroll();
      const onResize = () => {
        handleScroll();
        measureHeights();
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onResize);
      // Initial tick
      handleScroll();
      measureHeights();
      // Re-measure shortly after mount to catch image loads
      setTimeout(measureHeights, 100);
      setTimeout(measureHeights, 350);
      // Store stop function in ref
      lenisRef.current = {
        destroy: () => {
          window.removeEventListener('scroll', onScroll);
          window.removeEventListener('resize', onResize);
        },
      };
      return lenisRef.current;
    } else {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      const lenis = new Lenis({
        wrapper: scroller,
        content: scroller.querySelector('.scroll-stack-inner') as HTMLElement,
        duration: 1.2,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        touchMultiplier: 2,
        infinite: false,
        normalizeWheel: true,
        wheelMultiplier: 1,
        touchInertiaMultiplier: 35,
        lerp: 0.1,
        syncTouch: true,
        syncTouchLerp: 0.075,
        touchInertia: 0.6,
      } as LenisOptions);
      lenis.on('scroll', handleScroll);
      const raf = (time: number) => {
        lenis.raf(time);
        animationFrameRef.current = requestAnimationFrame(raf);
      };
      animationFrameRef.current = requestAnimationFrame(raf);
      lenisRef.current = lenis;
      return lenis;
    }
  }, [handleScroll, useWindowScroll, measureHeights]);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const cards = Array.from(
      useWindowScroll ? document.querySelectorAll('.scroll-stack-card') : scroller.querySelectorAll('.scroll-stack-card'),
    ) as HTMLElement[];
    cardsRef.current = cards;
    const transformsCache = lastTransformsRef.current;
    cards.forEach((card, i) => {
      if (fitToStack && useWindowScroll) {
        if (i < cards.length - 1) card.style.marginBottom = "0px";
        card.style.position = "absolute";
        card.style.top = "0";
        card.style.left = "0";
        card.style.right = "0";
        card.style.zIndex = String(cards.length - i);
      } else {
        if (i < cards.length - 1) card.style.marginBottom = `${itemDistance}px`;
        card.style.position = "";
        card.style.top = "";
        card.style.left = "";
        card.style.right = "";
        card.style.zIndex = "";
      }
      card.style.willChange = "transform, filter";
      card.style.transformOrigin = "top center";
      card.style.backfaceVisibility = "hidden";
      card.style.transform = "translateZ(0)";
      card.style.setProperty("-webkit-transform", "translateZ(0)");
      card.style.perspective = "1000px";
      card.style.setProperty("-webkit-perspective", "1000px");
    });

    setupLenis();
    updateCardTransforms();
    measureHeights();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      lenisRef.current?.destroy?.();
      lenisRef.current = null;
      stackCompletedRef.current = false;
      cardsRef.current = [];
      transformsCache.clear();
      isUpdatingRef.current = false;
    };
  }, [
    itemDistance,
    itemScale,
    itemStackDistance,
    stackPosition,
    scaleEndPosition,
    baseScale,
    scaleDuration,
    rotationAmount,
    blurAmount,
    useWindowScroll,
    onStackComplete,
    setupLenis,
    updateCardTransforms,
    fitToStack,
    measureHeights,
  ]);

  const containerClass = useWindowScroll ? className : `scroll-stack-scroller ${className}`.trim();
  const containerStyle = useWindowScroll
    ? ({
        height: fitToStack ? (measuredHeight ? `${measuredHeight}px` : '60vh') : 'auto',
        overflow: 'visible',
        marginBottom: fitToStack ? (typeof endSpacerPx === 'number' ? `${endSpacerPx}px` : '160px') : undefined,
        position: 'relative',
      } as React.CSSProperties)
    : undefined;
  const endSpacerStyle = fitToStack && useWindowScroll ? ({ height: '1px' } as React.CSSProperties) : undefined;
  return (
    <div className={containerClass} style={containerStyle} ref={scrollerRef}>
      <div className="scroll-stack-inner">
        {children}
        <div className="scroll-stack-end" style={endSpacerStyle} />
      </div>
    </div>
  );
}
