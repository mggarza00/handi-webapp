"use client";

import React, { useRef, useLayoutEffect, useState } from "react";
import RotatingText from "@/components/RotatingText";
import { motion, useAnimation } from "motion/react";

export default function RotatingTextTestPage() {
  const items = [
    "Fletero 🚚",
    "Chofer 🚛",
    "Ayudante general 🧰",
    "Mensajero 📦",
    "Guardia 🛡",
    "Técnico en a/c",
    "Carpintero 🪚",
    "Herrero",
    "Cerrajero 🔑",
    "Jardinero 🌿",
    "Cocinero 👨🍳",
    "Mesero 🍽",
    "Albañil 🧱",
  ];

  // Controls + refs para el deslizamiento del prefijo
  const prefixCtrlA = useAnimation();
  const prefixCtrlB = useAnimation();
  const wrapARef = useRef<HTMLSpanElement | null>(null);
  const wrapBRef = useRef<HTMLSpanElement | null>(null);
  const contentARef = useRef<HTMLSpanElement | null>(null);
  const contentBRef = useRef<HTMLSpanElement | null>(null);
  const lastWARef = useRef<number | null>(null);
  const lastWBRef = useRef<number | null>(null);
  const [dimsA, setDimsA] = useState<{ w: number; h: number } | null>(null);
  const [dimsB, setDimsB] = useState<{ w: number; h: number } | null>(null);

  const slidePrefixByWidth = (
    wrapRef: React.RefObject<HTMLElement>,
    lastWRef: React.MutableRefObject<number | null>,
    ctrl: any,
    fast = false,
  ) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const prevW = lastWRef.current ?? wrap.clientWidth;
    requestAnimationFrame(() => {
      const newW = wrap.clientWidth;
      lastWRef.current = newW;
      const deltaW = newW - prevW;
      const min = 4;
      const applied = Math.abs(deltaW) < min ? (deltaW >= 0 ? min : -min) : deltaW;
      const shift = -applied / 2;
      ctrl.set({ x: shift });
      requestAnimationFrame(() => {
        ctrl.start({ x: 0, transition: { duration: fast ? 0.18 : 0.2, ease: "easeOut" } });
      });
    });
  };

  const measureDims = (el: HTMLElement | null) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  };

  useLayoutEffect(() => {
    const d = measureDims(contentARef.current);
    if (d) setDimsA(d);
  }, []);
  useLayoutEffect(() => {
    const d = measureDims(contentBRef.current);
    if (d) setDimsB(d);
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-6 text-center text-2xl font-semibold tracking-tight">RotatingText Test</h1>

      {/* Ejemplo A: con prefijo deslizante (igual al home) */}
      <div className="mb-10">
        <div className="flex items-center justify-center gap-3">
          <motion.span animate={prefixCtrlA} className="text-slate-900 text-2xl font-semibold">
            Necesito un
          </motion.span>
          <motion.span
            ref={wrapARef}
            className="relative inline-block rounded-md bg-slate-200 px-2.5 py-1 overflow-hidden"
            layout
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            initial={false}
            animate={dimsA ? { width: dimsA.w, height: dimsA.h } : undefined}
            style={dimsA ? { width: dimsA.w, height: dimsA.h } : undefined}
          >
            <span ref={contentARef} className="block">
              <RotatingText
                texts={items}
                rotationInterval={3000}
                staggerDuration={0.015}
                mainClassName="text-slate-900 text-2xl font-semibold"
                onNext={() => {
                  slidePrefixByWidth(wrapARef as any, lastWARef, prefixCtrlA, true);
                  requestAnimationFrame(() => {
                    const d = measureDims(contentARef.current);
                    if (d) setDimsA(d);
                  });
                }}
              />
            </span>
          </motion.span>
        </div>
      </div>

      {/* Ejemplo B: solo el rotador, tamaño grande */}
      <div className="rounded-2xl border border-slate-200 p-6 text-center">
        <motion.span
          className="relative inline-block rounded-md bg-slate-200 px-3 py-1.5 overflow-hidden"
          layout
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          initial={false}
          animate={dimsB ? { width: dimsB.w, height: dimsB.h } : undefined}
          style={dimsB ? { width: dimsB.w, height: dimsB.h } : undefined}
        >
          <span ref={contentBRef} className="block">
            <RotatingText
              texts={items}
              rotationInterval={3000}
              staggerDuration={0.02}
              mainClassName="text-slate-900 text-3xl font-semibold"
              onNext={() => {
                requestAnimationFrame(() => {
                  const d = measureDims(contentBRef.current);
                  if (d) setDimsB(d);
                });
              }}
            />
          </span>
        </motion.span>
      </div>
    </div>
  );
}
