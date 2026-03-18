import Image from "next/image";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Props = {
  imageSrc: string;
  imageAlt: string;
  cta: ReactNode;
  imageClassName?: string;
  ctaWrapperClassName?: string;
  containerClassName?: string;
};

export default function CampaignHeroLanding({
  imageSrc,
  imageAlt,
  cta,
  imageClassName,
  ctaWrapperClassName,
  containerClassName,
}: Props) {
  return (
    <main className="min-h-screen bg-[#eef2f7] px-3 py-4 md:px-6 md:py-8">
      <section
        className={cn("mx-auto w-full max-w-[1240px]", containerClassName)}
      >
        <div className="relative overflow-hidden rounded-[28px] shadow-[0_30px_90px_-42px_rgba(8,40,119,0.5)]">
          <div className="relative min-h-[62vh] w-full md:min-h-[74vh] lg:min-h-[78vh]">
            <Image
              src={imageSrc}
              alt={imageAlt}
              fill
              priority
              className={cn("object-cover", imageClassName)}
              sizes="(min-width: 1280px) 1240px, 100vw"
            />
          </div>
          <div
            className={cn(
              "pointer-events-none absolute inset-0 flex items-end justify-center p-4 pb-6 md:justify-start md:p-8 md:pb-8",
              ctaWrapperClassName,
            )}
          >
            <div className="pointer-events-auto max-w-[calc(100%-2rem)] md:max-w-none">
              {cta}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
