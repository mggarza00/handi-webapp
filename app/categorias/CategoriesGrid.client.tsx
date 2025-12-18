"use client";

import Image from "next/image";

import type { CategoryCard } from "./types";

const isValidImageSrc = (src: string | null) => {
  if (!src) return false;
  return (
    src.startsWith("/") ||
    src.startsWith("http://") ||
    src.startsWith("https://")
  );
};

type Props = {
  cards: CategoryCard[];
};

export default function CategoriesGrid({ cards }: Props) {
  if (!cards.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-700 shadow-sm md:col-span-4 lg:col-span-5">
        No hay categorías activas disponibles.
      </div>
    );
  }

  return (
    <>
      {cards.map((card) => {
        const bg =
          card.color && card.color.startsWith("#") ? card.color : "#012A31";

        return (
          <div
            key={card.name}
            className="group relative overflow-hidden rounded-2xl shadow-sm"
            style={{ backgroundColor: bg }}
            aria-label={`Categoría ${card.name}`}
          >
            <div className="relative z-10 flex h-full flex-col gap-7 p-6 text-white">
              <p
                className="text-2xl font-semibold leading-snug"
                style={{
                  fontFamily:
                    "var(--font-stack-sans-medium, var(--font-stack-sans-text, var(--font-stack-sans)))",
                }}
              >
                {card.name}
              </p>

              {card.subcategories.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 md:grid-cols-2">
                  {card.subcategories.map((sub) => {
                    const iconSrc = isValidImageSrc(sub.iconUrl)
                      ? sub.iconUrl
                      : null;
                    const emoji = !iconSrc && sub.icon ? sub.icon.trim() : null;
                    return (
                      <div
                        key={`${card.name}-${sub.name}`}
                        title={sub.name}
                        className="flex items-center gap-2 rounded-xl bg-white/15 px-2 py-2 text-left text-sm font-medium leading-tight text-white"
                      >
                        <span className="flex h-4 w-4 items-center justify-center rounded-md bg-white/10 text-[13px] leading-none">
                          {emoji ? (
                            emoji
                          ) : iconSrc ? (
                            <Image
                              src={iconSrc}
                              alt=""
                              width={16}
                              height={16}
                              unoptimized
                              className="h-4 w-4 object-contain"
                            />
                          ) : (
                            <span className="block h-2 w-2 rounded-full bg-white/70" />
                          )}
                        </span>
                        <span
                          className="line-clamp-2 break-words"
                          style={{
                            fontFamily:
                              "var(--font-inter, var(--font-inter-light, var(--font-sans)))",
                          }}
                        >
                          {sub.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              <div className="relative mt-auto h-44 w-full overflow-hidden rounded-xl bg-black/10">
                {isValidImageSrc(card.image) ? (
                  <Image
                    src={card.image as string}
                    alt={`Trabajo de ${card.name}`}
                    fill
                    className="object-cover transition duration-300 group-hover:scale-[1.03]"
                    sizes="(min-width: 1024px) 220px, 50vw"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-medium text-white/70">
                    Imagen no disponible
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
