// components/quote/QuoteImage.tsx
import React from "react";

type QuoteItem = { description: string; amount: number };
type QuoteImageProps = {
  logoUrl?: string;
  title?: string;
  folio: string;
  issuedAtISO: string;
  professionalName: string;
  clientName: string;
  serviceTitle: string;
  items: QuoteItem[];
  currency?: "MXN" | "USD" | string;
  notes?: string;
  brandHex?: string;
  grayHex?: string;
};

const peso = (n: number, currency: string = "MXN") =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(n);

export default function QuoteImage({
  logoUrl,
  title = "Cotización",
  folio,
  issuedAtISO,
  professionalName,
  clientName,
  serviceTitle,
  items,
  currency = "MXN",
  notes,
  brandHex = "#0E7490",
  grayHex = "#E5E7EB",
}: QuoteImageProps) {
  const subtotal = items.reduce((acc, i) => acc + (i.amount || 0), 0);
  const total = subtotal;
  const dateStr = new Date(issuedAtISO).toLocaleDateString("es-MX", { dateStyle: "medium" });

  return (
    <div style={{ width: 1080, height: 1600, backgroundColor: "#FFFFFF", color: "#0F172A", display: "flex", flexDirection: "column", padding: 48, fontFamily: "Inter", gap: 24 }}>
      {/* Header simple */}
      <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: -0.5, color: brandHex }}>{`Homaid ${title}`}</span>

      {/* Meta compacta */}
      <span style={{ fontSize: 24, color: "#334155" }}>{`Folio: ${folio}  •  Fecha: ${dateStr}`}</span>

      {/* Separador */}
      <div style={{ display: "flex", height: 2, backgroundColor: grayHex }} />

      {/* Personas */}
      <span style={{ fontSize: 28 }}>{`Profesional: ${professionalName}`}</span>
      <span style={{ fontSize: 28 }}>{`Cliente: ${clientName}`}</span>
      <span style={{ fontSize: 28 }}>{`Servicio: ${serviceTitle}`}</span>

      {/* Encabezado tabla */}
      <div style={{ display: "flex", justifyContent: "space-between", borderTop: `2px solid ${grayHex}`, borderBottom: `2px solid ${grayHex}`, padding: "14px 0" }}>
        <span style={{ fontSize: 28, fontWeight: 600 }}>Concepto</span>
        <span style={{ fontSize: 28, fontWeight: 600, minWidth: 260, textAlign: "right" }}>Importe</span>
      </div>
      {/* Filas */}
      {items.map((it, idx) => (
        <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid ${grayHex}` }}>
          <span style={{ fontSize: 28, maxWidth: 720 }}>{it.description}</span>
          <span style={{ fontSize: 28, minWidth: 260, textAlign: "right" }}>{peso(it.amount, currency)}</span>
        </div>
      ))}

      {/* Total */}
      <div style={{ display: "flex", justifyContent: "space-between", alignSelf: "flex-end", width: 540, border: `2px solid ${brandHex}`, borderRadius: 24, padding: 24, marginTop: 8 }}>
        <span style={{ fontSize: 32, fontWeight: 800, color: brandHex }}>Total</span>
        <span style={{ fontSize: 32, fontWeight: 800, color: brandHex }}>{peso(total, currency)}</span>
      </div>

      {/* Notas */}
      {notes ? (
        <span style={{ marginTop: 8, fontSize: 22, color: "#475569", lineHeight: 1.4, whiteSpace: "pre-wrap" }}>{notes}</span>
      ) : null}

      {/* Footer */}
      <div style={{ display: "flex", marginTop: "auto", justifyContent: "center" }}>
        <span style={{ fontSize: 20, color: "#94A3B8" }}>Precio no incluye IVA ni comision. Sujeto a condiciones del servicio.</span>
      </div>
    </div>
  );
}
