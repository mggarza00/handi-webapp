"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

type CardType = "client" | "pro";

export default function HowToUseHandiSection() {
  const router = useRouter();
  const [hoveredCard, setHoveredCard] = useState<CardType | null>(null);

  return (
    <section className="bg-[#F5F7FA] py-12 md:py-16">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <h2
          className="text-2xl md:text-3xl font-semibold text-[#082877] mb-8"
          style={{
            fontFamily:
              '"Stack Sans Text", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}
        >
          Elige cómo quieres usar Handi
        </h2>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1.3fr)] items-stretch">
          <div className="flex flex-col gap-4">
            <p
              className="text-lg md:text-xl font-semibold text-[#082877]"
              style={{
                fontFamily:
                  '"Stack Sans Text", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              }}
            >
              ¿Listo para solicitar un servicio?
            </p>

            <button
              type="button"
              onClick={() => router.push("/requests/new")}
              className="inline-flex items-center justify-center rounded-full px-6 py-2.5 text-xs font-medium text-white md:text-sm translate-y-3"
              style={{
                backgroundColor: "#082877",
                fontFamily:
                  '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                transform: "scale(0.85)",
              }}
            >
              Solicitar servicio
            </button>
          </div>

          <button
            type="button"
            onMouseEnter={() => setHoveredCard("client")}
            onMouseLeave={() => setHoveredCard(null)}
            onFocus={() => setHoveredCard("client")}
            onBlur={() => setHoveredCard(null)}
            className={cn(
              "relative flex flex-col justify-between rounded-3xl px-3 md:px-5 py-6 md:py-8 text-left transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#5A9EF6] scale-90 md:ml-10",
              hoveredCard === "client"
                ? "scale-100 md:scale-[1.03] shadow-xl md:mr-2"
                : hoveredCard === "pro"
                  ? "scale-85 opacity-80 md:mr-4"
                  : "opacity-90 md:mr-6",
              "md:-mr-2 md:ml-10",
            )}
            style={{ backgroundColor: "#082877" }}
          >
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <p
                  className="mb-1 text-sm uppercase tracking-wide text-[#5A9EF6]"
                  style={{
                    fontFamily:
                      '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  }}
                >
                  Soy cliente
                </p>
                <h3
                  className="text-base md:text-xl font-medium text-white leading-snug"
                  style={{
                    fontFamily:
                      '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  }}
                >
                  Tengo un problema que quiero solucionar
                </h3>
              </div>
              <Image
                src="/icons/engraneceleste_icon.svg"
                alt=""
                width={36}
                height={36}
                className="w-8 h-8 md:w-9 md:h-9 flex-shrink-0"
              />
            </div>

            <div className="flex justify-start">
              <span
                className="inline-flex items-center justify-center rounded-full px-6 py-2 text-sm font-medium text-[#082877]"
                style={{
                  backgroundColor: "#5A9EF6",
                  fontFamily:
                    '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                }}
              >
                Buscar un profesional
              </span>
            </div>
          </button>

          <button
            type="button"
            onMouseEnter={() => setHoveredCard("pro")}
            onMouseLeave={() => setHoveredCard(null)}
            onFocus={() => setHoveredCard("pro")}
            onBlur={() => setHoveredCard(null)}
            className={cn(
              "relative flex flex-col justify-between rounded-3xl px-6 md:px-8 py-6 md:py-8 text-left transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#A1D301] scale-90",
              hoveredCard === "pro"
                ? "scale-100 md:scale-[1.03] shadow-xl md:ml-2"
                : hoveredCard === "client"
                  ? "scale-85 opacity-80 md:ml-4"
                  : "opacity-90 md:ml-6",
              "md:-ml-2",
            )}
            style={{ backgroundColor: "#A1D301" }}
          >
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <p
                  className="mb-1 text-sm uppercase tracking-wide text-[#00442F]"
                  style={{
                    fontFamily:
                      '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  }}
                >
                  Soy profesional
                </p>
                <h3
                  className="text-base md:text-xl font-medium text-[#00442F] leading-snug"
                  style={{
                    fontFamily:
                      '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  }}
                >
                  Quiero trabajar con Handi
                </h3>
              </div>
              <Image
                src="/icons/Icono_pro_verde.svg"
                alt=""
                width={36}
                height={36}
                className="w-8 h-8 md:w-9 md:h-9 flex-shrink-0"
              />
            </div>

            <div className="flex justify-start">
              <span
                className="inline-flex items-center justify-center rounded-full px-6 py-2 text-sm font-medium text-white"
                style={{
                  backgroundColor: "#00442F",
                  fontFamily:
                    '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                }}
              >
                Ofrecer mis servicios
              </span>
            </div>
          </button>
        </div>
      </div>
    </section>
  );
}
