import * as React from "react";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Politicas de Facturacion | Handi Mexico",
  description:
    "Politicas de facturacion y liquidaciones de Handi en Mexico: rol de intermediacion, escenarios de emision de factura, comisiones y condiciones de pago.",
  robots: {
    index: true,
    follow: true,
  },
  alternates: { canonical: "/politicas-facturacion" },
};

function todayMxIso(): string {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Monterrey",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return f.format(new Date());
}

export default function PoliticasFacturacionPage() {
  const lastUpdated = todayMxIso();
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Politicas de facturacion Handi
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Ambito: Mexico (SAT). Ultima actualizacion: {lastUpdated}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-12">
        <aside className="hidden lg:block lg:col-span-4">
          <nav
            aria-label="Indice"
            className="sticky top-24 rounded-lg border bg-white p-4 shadow-sm"
          >
            <p className="mb-2 text-sm font-medium text-slate-700">Indice</p>
            <ul className="space-y-1 text-sm">
              <li>
                <a className="hover:underline" href="#modelo">
                  1) Modelo operativo y de facturacion
                </a>
              </li>
              <li>
                <a className="hover:underline" href="#escenarios">
                  2) Escenarios de emision de factura del servicio
                </a>
              </li>
              <li>
                <a className="hover:underline" href="#comisiones">
                  3) Comisiones y cargos de Handi
                </a>
              </li>
              <li>
                <a className="hover:underline" href="#factura-handi">
                  4) Facturas emitidas por Handi
                </a>
              </li>
              <li>
                <a className="hover:underline" href="#obligaciones-pro">
                  5) Obligaciones fiscales del Profesional
                </a>
              </li>
              <li>
                <a className="hover:underline" href="#pagos-liquidez">
                  6) Cobros, retenciones y liquidaciones
                </a>
              </li>
              <li>
                <a className="hover:underline" href="#cumplimiento">
                  7) Compliance, KYC y prevencion de fraude
                </a>
              </li>
              <li>
                <a className="hover:underline" href="#actualizacion">
                  8) Actualizacion de datos y solicitudes
                </a>
              </li>
              <li>
                <a className="hover:underline" href="#faq">
                  9) Preguntas frecuentes
                </a>
              </li>
              <li>
                <a className="hover:underline" href="#contacto">
                  10) Contacto
                </a>
              </li>
            </ul>
          </nav>
        </aside>

        <section className="prose prose-slate max-w-none dark:prose-invert lg:col-span-8">
          <p>
            Esta politica describe como funciona la facturacion y la gestion de
            fondos en Handi. Handi opera como plataforma de intermediacion y
            facilitacion tecnologica entre Clientes y Profesionales.
          </p>
          <p className="text-xs text-slate-600">
            Aviso: Este contenido es informativo y no constituye asesoria fiscal
            o legal.
          </p>

          <h2 id="modelo" className="scroll-mt-24 text-xl font-semibold">
            1) Modelo operativo y de facturacion
          </h2>
          <ul className="list-disc pl-5">
            <li>
              El servicio principal es prestado por el Profesional independiente
              o empresa profesional.
            </li>
            <li>
              Handi facilita la operacion: solicitud, contacto, acuerdos, cobro
              y liquidacion, segun el flujo de la Plataforma.
            </li>
            <li>
              Que Handi procese, administre o retenga temporalmente fondos no
              implica por si solo que Handi sea el prestador del servicio
              principal.
            </li>
          </ul>

          <h2 id="escenarios" className="scroll-mt-24 text-xl font-semibold">
            2) Escenarios de emision de factura del servicio
          </h2>
          <ol className="list-decimal pl-5">
            <li>
              <strong>Profesional empresa:</strong> el Profesional factura
              directamente el servicio al Cliente.
            </li>
            <li>
              <strong>
                Profesional persona fisica que puede facturar y no autoriza a
                Handi:
              </strong>{" "}
              el Profesional factura directamente el servicio al Cliente.
            </li>
            <li>
              <strong>
                Profesional persona fisica que autoriza expresamente a Handi:
              </strong>{" "}
              Handi podra emitir la factura del servicio por cuenta y/o en
              nombre del Profesional, cuando proceda, sujeto a la autorizacion
              otorgada, a la informacion proporcionada y a la legislacion
              aplicable.
            </li>
          </ol>
          <p className="mt-2">
            En todos los escenarios, el Profesional mantiene la responsabilidad
            de la correcta prestacion del servicio principal.
          </p>
          <p className="mt-2">
            Fuera del escenario de autorizacion expresa y procedencia legal, la
            facturacion del servicio principal corresponde al Profesional.
          </p>

          <h2 id="comisiones" className="scroll-mt-24 text-xl font-semibold">
            3) Comisiones y cargos de Handi
          </h2>
          <p>
            Handi puede cobrar comisiones de intermediacion, cargos
            administrativos y otros cargos aplicables informados en la
            Plataforma.
          </p>
          <p>
            Los porcentajes, montos minimos, topes y reglas operativas vigentes
            se muestran durante el flujo de contratacion y pueden actualizarse.
          </p>

          <h2 id="factura-handi" className="scroll-mt-24 text-xl font-semibold">
            4) Facturas emitidas por Handi
          </h2>
          <ul className="list-disc pl-5">
            <li>Handi puede emitir factura por su propia comision y cargos.</li>
            <li>
              Cuando exista autorizacion valida del Profesional y proceda
              legalmente, Handi podra emitir factura del servicio por cuenta del
              Profesional.
            </li>
            <li>
              La emision por cuenta del Profesional no cambia la naturaleza de
              intermediacion de Handi.
            </li>
          </ul>

          <h2
            id="obligaciones-pro"
            className="scroll-mt-24 text-xl font-semibold"
          >
            5) Obligaciones fiscales del Profesional
          </h2>
          <ul className="list-disc pl-5">
            <li>
              Mantener informacion fiscal correcta, completa y vigente en la
              Plataforma.
            </li>
            <li>
              Contar con habilitacion para facturar cuando corresponda a su
              escenario operativo.
            </li>
            <li>
              Mantener vigentes sus datos bancarios, autorizaciones y
              documentacion necesaria para facturacion, cobro y liquidacion.
            </li>
            <li>
              Cumplir sus impuestos, contribuciones, obligaciones regulatorias y
              documentacion de su actividad.
            </li>
          </ul>

          <h2
            id="pagos-liquidez"
            className="scroll-mt-24 text-xl font-semibold"
          >
            6) Cobros, retenciones y liquidaciones
          </h2>
          <p>
            Los fondos del servicio pueden ser cobrados, administrados,
            retenidos temporalmente, conciliados y/o liquidados por Handi o por
            terceros procesadores de pago autorizados.
          </p>
          <p>
            Los tiempos de disponibilidad y liquidacion pueden depender de
            validaciones operativas, cumplimiento, reglas de riesgo y ventanas
            de terceros proveedores de pago.
          </p>

          <h2 id="cumplimiento" className="scroll-mt-24 text-xl font-semibold">
            7) Compliance, KYC y prevencion de fraude
          </h2>
          <p>
            Handi puede solicitar, recopilar, validar y compartir informacion
            con procesadores de pago y proveedores autorizados para onboarding,
            KYC, compliance, prevencion de fraude, facturacion y dispersion.
          </p>
          <p>
            Handi puede retener, suspender o ajustar pagos/liquidaciones cuando
            existan, entre otras causas:
          </p>
          <ul className="list-disc pl-5">
            <li>incumplimientos fiscales o regulatorios;</li>
            <li>falta de documentacion o datos inconsistentes;</li>
            <li>riesgo de fraude, disputas o chargebacks;</li>
            <li>restricciones regulatorias o de procesadores de pago;</li>
            <li>
              problemas en onboarding de pagos o verificacion de identidad.
            </li>
          </ul>

          <h2 id="actualizacion" className="scroll-mt-24 text-xl font-semibold">
            8) Actualizacion de datos y solicitudes
          </h2>
          <p>
            Clientes y Profesionales deben revisar y actualizar oportunamente
            sus datos fiscales y de facturacion.
          </p>
          <p>
            Correcciones, cancelaciones o reemisiones de comprobantes estan
            sujetas a ventanas operativas, informacion disponible y normativa
            aplicable.
          </p>

          <h2 id="faq" className="scroll-mt-24 text-xl font-semibold">
            9) Preguntas frecuentes
          </h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-medium">
                Si Handi cobra al Cliente, Handi se vuelve prestador del
                servicio?
              </h3>
              <p className="mt-1 text-slate-700">
                No, por si solo no. Handi facilita el flujo de cobro y
                liquidacion del marketplace, pero el servicio principal lo
                presta el Profesional.
              </p>
            </div>
            <div>
              <h3 className="text-base font-medium">
                Handi siempre factura el servicio principal?
              </h3>
              <p className="mt-1 text-slate-700">
                No. Depende del escenario del Profesional y, en su caso, de la
                autorizacion expresa para facturar por su cuenta cuando proceda.
              </p>
            </div>
            <div>
              <h3 className="text-base font-medium">
                Handi garantiza el cumplimiento fiscal del Profesional?
              </h3>
              <p className="mt-1 text-slate-700">
                No. El Profesional mantiene responsabilidad sobre sus
                obligaciones fiscales y regulatorias.
              </p>
            </div>
          </div>

          <h2 id="contacto" className="scroll-mt-24 text-xl font-semibold">
            10) Contacto
          </h2>
          <p>
            Soporte Handi:{" "}
            <a className="underline" href="mailto:soporte@handi.mx">
              soporte@handi.mx
            </a>
          </p>
          <p>
            Tel/WhatsApp:{" "}
            <a className="underline" href="tel:+528130878691">
              81 3087 8691
            </a>
          </p>
          <p>Horario: LV, 9:00-18:00 (CDMX)</p>

          <h3 className="mt-6 text-base font-semibold">Aviso legal</h3>
          <p className="text-slate-700">
            Esta informacion es general y puede ajustarse por cambios
            operativos, regulatorios o de terceros procesadores. Revisa tambien
            nuestros{" "}
            <a className="underline" href="/terms-and-conditions">
              Terminos y Condiciones
            </a>{" "}
            y
            <a className="underline ml-1" href="/privacy">
              Aviso de Privacidad
            </a>
            .
          </p>

          <p className="mt-6 text-sm text-slate-600">
            Ultima actualizacion: {lastUpdated}
          </p>
        </section>
      </div>
    </main>
  );
}
