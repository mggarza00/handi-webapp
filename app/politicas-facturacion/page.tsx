import * as React from "react";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Políticas de Facturación | Handi México",
  description:
    "Políticas de facturación para México (SAT): emisión de CFDI, datos requeridos, responsabilidades y comisiones. Conoce cómo Handi gestiona la generación de facturas de servicios.",
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
  return f.format(new Date()); // en-CA => YYYY-MM-DD
}

export default function PoliticasFacturacionPage() {
  const lastUpdated = todayMxIso();
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Políticas de facturación  Handi</h1>
        <p className="mt-1 text-sm text-slate-600">Ámbito: México (SAT). Última actualización: {lastUpdated}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Índice (visible en desktop) */}
        <aside className="hidden lg:block lg:col-span-4">
          <nav aria-label="Índice" className="sticky top-24 rounded-lg border bg-white p-4 shadow-sm">
            <p className="mb-2 text-sm font-medium text-slate-700">Índice</p>
            <ul className="space-y-1 text-sm">
              <li><a className="hover:underline" href="#modelo">1) Modelo de facturación</a></li>
              <li><a className="hover:underline" href="#comisiones">2) Esquema de comisiones</a></li>
              <li><a className="hover:underline" href="#factura-homaid">3) Factura de la comisión de Handi</a></li>
              <li><a className="hover:underline" href="#factura-servicio">4) Factura del servicio del Profesional</a></li>
              <li><a className="hover:underline" href="#actualizacion">5) Actualización de datos fiscales</a></li>
              <li><a className="hover:underline" href="#plazos">6) Plazos y solicitudes</a></li>
              <li><a className="hover:underline" href="#reembolsos">7) Reembolsos y cancelaciones</a></li>
              <li><a className="hover:underline" href="#requisitos-pro">8) Requisitos para Profesionales</a></li>
              <li><a className="hover:underline" href="#faq">9) Preguntas frecuentes</a></li>
              <li><a className="hover:underline" href="#contacto">10) Contacto</a></li>
            </ul>
          </nav>
        </aside>

        {/* Contenido principal */}
        <section className="prose prose-slate max-w-none dark:prose-invert lg:col-span-8">
          <p>
            En Handi buscamos transparencia al momento de facturar servicios y comisiones. Esta página explica quién
            factura qué, plazos, requisitos y casos frecuentes para clientes y profesionales en México.
          </p>
          <p className="text-xs text-slate-600">Aviso: Este contenido es informativo y no constituye asesoría fiscal.</p>

          <h2 id="modelo" className="scroll-mt-24 text-xl font-semibold">1) Modelo de facturación</h2>
          <ul className="list-disc pl-5">
            <li>El servicio lo factura el Profesional al Cliente.</li>
            <li>Handi no factura el servicio (mano de obra/insumo) del profesional.</li>
          </ul>
          <ul className="list-disc pl-5 mt-2">
            <li>Handi factura únicamente su comisión de plataforma.</li>
            <li>
              El Cliente recibe factura por la comisión de Handi y, por separado, factura del Profesional por el servicio.
            </li>
          </ul>
          <p className="mt-2">
            <strong>Nota:</strong> Si un Profesional aún no puede facturar (sin RFC/CSD), Handi no emite factura del servicio en su
            nombre. En ese caso, el Cliente solo recibe la factura de la comisión de Handi y un comprobante simple/recibo
            del servicio, hasta que el Profesional esté en condiciones de facturar.
          </p>

          <h2 id="comisiones" className="scroll-mt-24 text-xl font-semibold">2) Esquema de comisiones</h2>
          <h3 className="text-base font-medium">Acuerdo vigente</h3>
          <p>
            Comisión total: 10% del precio del servicio, distribuida así:
          </p>
          <ul className="list-disc pl-5">
            <li>5% lo paga el Cliente (comisión al momento del pago).</li>
            <li>5% se descuenta al Profesional al liberar el pago.</li>
          </ul>
          <h3 className="mt-4 text-base font-medium">Topes y mínimos</h3>
          <ul className="list-disc pl-5">
            <li>
              Tope por servicio: si el total del servicio es mayor a $30,000 MXN, la comisión se capa en $1,500 MXN por cada
              parte (Cliente $1,500 + Profesional $1,500 = $3,000 MXN máximos en total).
            </li>
            <li>
              Mínimo: para servicios menores a $1,000 MXN, la comisión es $50 MXN para el Cliente y $50 MXN para el Profesional.
            </li>
          </ul>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100 text-slate-700">
                  <th className="px-3 py-2 text-left font-medium">Total del servicio</th>
                  <th className="px-3 py-2 text-left font-medium">Comisión (Cliente / Profesional)</th>
                  <th className="px-3 py-2 text-left font-medium">Notas</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <td className="px-3 py-2">$1,000 MXN</td>
                  <td className="px-3 py-2">Cliente $50 / Profesional $50</td>
                  <td className="px-3 py-2">(mínimo)</td>
                </tr>
                <tr className="border-t">
                  <td className="px-3 py-2">$5,000 MXN</td>
                  <td className="px-3 py-2">Cliente $250 / Profesional $250</td>
                  <td className="px-3 py-2">(5% y 5%)</td>
                </tr>
                <tr className="border-t">
                  <td className="px-3 py-2">$30,000 MXN</td>
                  <td className="px-3 py-2">Cliente $1,500 / Profesional $1,500</td>
                  <td className="px-3 py-2">(tope)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 id="factura-homaid" className="scroll-mt-24 text-xl font-semibold">3) Factura de la comisión de Handi</h2>
          <ul className="list-disc pl-5">
            <li><strong>Emisor:</strong> Handi.</li>
            <li><strong>Receptor:</strong> Cliente (datos fiscales completos).</li>
            <li><strong>CFDI:</strong> Se emite al pagar la comisión.</li>
            <li>
              <strong>Datos requeridos:</strong> RFC, Razón social, Código postal del domicilio fiscal, Uso de CFDI, Correo electrónico.
            </li>
            <li>
              <strong>Plazo para solicitarla:</strong> Dentro del mismo mes del pago o máximo 5 días hábiles posteriores al pago
              (lo que ocurra primero).
            </li>
          </ul>

          <p className="mt-2"><strong>Reexpedición/cancelación:</strong> Sujeta a reglas del SAT y ventanas de tiempo; podría requerir cancelación y reemisión.</p>

          <h2 id="factura-servicio" className="scroll-mt-24 text-xl font-semibold">4) Factura del servicio del Profesional</h2>
          <ul className="list-disc pl-5">
            <li><strong>Emisor:</strong> Profesional.</li>
            <li><strong>Receptor:</strong> Cliente.</li>
            <li>
              <strong>Momento de emisión:</strong> Conforme acuerden pago/entrega (PPD/PPD+Complemento o PUE).
            </li>
            <li>
              <strong>Datos requeridos por el Profesional:</strong> RFC del Cliente, Razón social, CP, Uso de CFDI, forma/método de pago.
            </li>
          </ul>
          <p className="mt-2">
            <strong>Si el Profesional no puede facturar:</strong> Handi no emite factura por el servicio. El Cliente podrá:
          </p>
          <ul className="list-disc pl-5">
            <li>Recibir factura solo de la comisión de Handi.</li>
            <li>Solicitar al Profesional su factura cuando éste cuente con RFC/CSD y pueda emitirla.</li>
          </ul>

          <h2 id="actualizacion" className="scroll-mt-24 text-xl font-semibold">5) Actualización de datos fiscales</h2>
          <p>
            Puedes actualizar tu RFC, razón social y domicilio fiscal desde tu cuenta o escribiendo a soporte.
          </p>
          <p>
            Los cambios aplican para CFDI futuros; para CFDI emitidos, se requiere proceso de cancelación/sustitución
            (si la regla del SAT y el tiempo lo permiten).
          </p>

          <h2 id="plazos" className="scroll-mt-24 text-xl font-semibold">6) Plazos y solicitudes</h2>
          <ul className="list-disc pl-5">
            <li>
              Solicitud de factura nominativa: dentro del mes del pago del concepto (comisión) o 5 días hábiles posteriores,
              lo que ocurra primero.
            </li>
            <li>
              Factura global al público en general: Handi puede emitirla por comisiones cuando no se solicite nominativa a tiempo.
            </li>
            <li>
              Factura nominativa posterior a global: solo si la normativa y el plazo del SAT lo permiten (puede requerir cancelación de la global y reemisión).
            </li>
          </ul>

          <h2 id="reembolsos" className="scroll-mt-24 text-xl font-semibold">7) Reembolsos y cancelaciones</h2>
          <ul className="list-disc pl-5">
            <li>Si procede un reembolso del servicio, el Profesional gestiona la nota de crédito/cancelación correspondiente.</li>
            <li>
              Si procede un reembolso de comisión, Handi gestionará la cancelación o nota de crédito de su CFDI conforme a la operación.
            </li>
          </ul>

          <h2 id="requisitos-pro" className="scroll-mt-24 text-xl font-semibold">8) Requisitos para Profesionales</h2>
          <ul className="list-disc pl-5">
            <li>RFC activo, CSD y e.firma vigentes para poder facturar el servicio.</li>
            <li>
              Mantener datos fiscales actualizados y emitir CFDI conforme a ley (PPD/PUE, complementos, retenciones cuando apliquen).
            </li>
          </ul>

          <h2 id="faq" className="scroll-mt-24 text-xl font-semibold">9) Preguntas frecuentes</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-medium">¿Puedo deducir el servicio si el Profesional no factura?</h3>
              <p className="mt-1 text-slate-700">
                Puedes deducir la comisión de Handi (si solicitas CFDI a tiempo). El servicio requerirá CFDI del Profesional para efectos fiscales.
              </p>
            </div>
            <div>
              <h3 className="text-base font-medium">¿Qué pasa si pedí factura con datos incorrectos?</h3>
              <p className="mt-1 text-slate-700">
                Podría requerir cancelación y reemisión dentro de las ventanas del SAT. Escríbenos lo antes posible.
              </p>
            </div>
            <div>
              <h3 className="text-base font-medium">¿Puedo cambiar el RFC receptor después del mes?</h3>
              <p className="mt-1 text-slate-700">
                Generalmente no, por restricciones del SAT. Contáctanos de inmediato si necesitas corrección.
              </p>
            </div>
          </div>

          <h2 id="contacto" className="scroll-mt-24 text-xl font-semibold">10) Contacto</h2>
          <p>
            Soporte Handi: <a className="underline" href="mailto:soporte@homaid.com">soporte@homaid.com</a> (ejemplo)
          </p>
          <p>Horario: LV, 9:00–18:00 (CDMX)</p>

          <h3 className="mt-6 text-base font-semibold">Aviso legal</h3>
          <p className="text-slate-700">
            La información aquí expuesta es de carácter general y no constituye asesoría fiscal. Las políticas pueden cambiar por
            actualización normativa o mejoras del servicio. Revisa también nuestros <a className="underline" href="/terminos">Términos</a> y
            <a className="underline ml-1" href="/privacy">Aviso de Privacidad</a>.
          </p>

          <p className="mt-6 text-sm text-slate-600">Última actualización: {lastUpdated}</p>
        </section>
      </div>
    </main>
  );
}
