import Image from "next/image";
import Link from "next/link";

import {
  stackSansLight,
  stackSansMedium,
} from "@/app/(site)/(landing)/landing-fonts";

type ProtectedPaymentsCardProps = {
  className?: string;
};

export default function ProtectedPaymentsCard({
  className = "bg-slate-50 mt-6 md:mt-10",
}: ProtectedPaymentsCardProps) {
  return (
    <section className={className}>
      <div className="relative z-10 mx-auto max-w-5xl px-4 py-8">
        <div className="mt-2 md:mt-4">
          <div className="grid overflow-hidden rounded-3xl border border-slate-200 shadow-xl md:grid-cols-[1.05fr_0.95fr]">
            <div className="relative min-h-[280px] md:min-h-[360px]">
              <Image
                src="/images/e533c387b9255d160d3c89dacf043df7010ca64b.jpg"
                alt="Profesional Handi listo para trabajar"
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 40vw, (min-width: 768px) 50vw, 100vw"
              />
            </div>
            <div className="flex flex-col justify-between gap-10 sm:gap-8 bg-[#114430] p-6 text-white sm:p-8">
              <div className="space-y-5 relative top-6 sm:top-8">
                <div className="flex items-start gap-3">
                  <Image
                    src="/icons/candado_lima.svg"
                    alt="Candado"
                    width={80}
                    height={80}
                    className="h-[4rem] w-[4rem] sm:h-[4.5rem] sm:w-[4.5rem] flex-shrink-0"
                  />
                  <h3
                    className={`${stackSansMedium.className} text-2xl leading-tight text-white sm:text-3xl`}
                  >
                    <span className="block">Pagos 100%</span>
                    <span className="block">protegidos</span>
                  </h3>
                </div>
                <p
                  className={`${stackSansLight.className} text-sm text-white/90 sm:text-base`}
                >
                  Los pagos de los servicios se liberan a los profesionales
                  hasta que confirmes que el trabajo se realizo con exito.
                </p>
              </div>
              <Link
                href="/pagos"
                className={`${stackSansMedium.className} inline-flex w-fit items-center justify-center rounded-full bg-[#A6D234] px-8 py-3 text-base text-[#114430] shadow-sm transition hover:bg-[#9bc32f]`}
              >
                Como funciona
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
