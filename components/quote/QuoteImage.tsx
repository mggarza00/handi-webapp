// components/quote/QuoteImage.tsx
import React from "react";

type QuoteItem = { description: string; amount: number };
type QuoteImageProps = {
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
  logoUrl?: string | null;
  watermarkUrl?: string | null;
  logoDataUrl?: string | null;
  watermarkDataUrl?: string | null;
};

const peso = (n: number, currency: string = "MXN") =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(n);

export default function QuoteImage({
  title: _title = "Cotización",
  folio,
  issuedAtISO,
  professionalName,
  clientName,
  serviceTitle,
  items,
  currency = "MXN",
  notes,
  brandHex: _brandHex = "#0E7490",
  grayHex: _grayHex = "#E5E7EB",
  logoUrl,
  watermarkUrl,
  logoDataUrl,
  watermarkDataUrl,
}: QuoteImageProps) {
  const subtotal = items.reduce((acc, i) => acc + (i.amount || 0), 0);
  const total = subtotal;
  const dateStr = new Date(issuedAtISO).toLocaleDateString("es-MX", {
    dateStyle: "medium",
  });
  const paperMaxWidth = 880;
  const primary = "#2BB3C0";
  const text = "#0F172A";
  const muted = "#64748B";
  const border = "#E2E8F0";
  const background = "#F6F8FB";
  const softShadow = "0px 20px 60px rgba(15, 23, 42, 0.08)";
  const stackSans =
    "'Stack Sans', 'Inter', 'Helvetica Neue', Arial, sans-serif";
  const inter = "'Inter', 'Helvetica Neue', Arial, sans-serif";
  const watermarkSize = 520;
  const brandLogo = logoDataUrl || logoUrl || "/images/LOGO_HANDI_DB.png";
  const watermarkImg =
    watermarkDataUrl || watermarkUrl || "/images/FAVICON_FOOTER.png";
  const currencyStyle = {
    fontVariantNumeric: "tabular-nums lining-nums",
    fontFeatureSettings: "'tnum' 1, 'lnum' 1",
  } as const;

  return (
    <div
      style={{
        width: 1080,
        height: 1600,
        backgroundColor: background,
        color: text,
        display: "flex",
        justifyContent: "center",
        padding: 48,
        boxSizing: "border-box",
        fontFamily: inter,
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: paperMaxWidth,
          backgroundColor: "#FFFFFF",
          borderRadius: 24,
          boxShadow: softShadow,
          padding: 48,
          display: "flex",
          flexDirection: "column",
          gap: 28,
          overflow: "hidden",
        }}
      >
        {/* Watermark */}
        {watermarkImg ? (
          <div
            style={{
              position: "absolute",
              bottom: -80,
              right: -120,
              width: watermarkSize,
              height: watermarkSize,
              opacity: 0.12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
              overflow: "hidden",
            }}
            aria-hidden="true"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={watermarkImg}
              alt=""
              style={{
                width: "120%",
                height: "120%",
                objectFit: "contain",
                filter: "grayscale(8%)",
              }}
            />
          </div>
        ) : null}

        {/* Header */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 16,
            }}
          >
            {brandLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brandLogo}
                alt="Handi"
                style={{
                  height: 64,
                  width: 64,
                  borderRadius: 14,
                  objectFit: "cover",
                  border: `1px solid ${border}`,
                }}
              />
            ) : null}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span
                style={{
                  fontFamily: stackSans,
                  fontSize: 36,
                  fontWeight: 700,
                  letterSpacing: -0.6,
                  color: text,
                }}
              >
                Cotización
              </span>
              <span style={{ fontSize: 16, color: muted }}>
                Resumen del servicio
              </span>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              minWidth: 180,
              textAlign: "right",
              fontSize: 14,
              color: muted,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
                alignItems: "center",
              }}
            >
              <span>Folio</span>
              <strong style={{ fontFamily: inter, color: text, fontSize: 16 }}>
                {folio}
              </strong>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
                alignItems: "center",
              }}
            >
              <span>Fecha</span>
              <strong style={{ fontFamily: inter, color: text, fontSize: 16 }}>
                {dateStr}
              </strong>
            </div>
          </div>
        </div>

        {/* Datos */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          {[
            { label: "Profesional", value: professionalName },
            { label: "Cliente", value: clientName },
            { label: "Servicio", value: serviceTitle },
          ].map((item, idx) => (
            <div
              key={idx}
              style={{
                border: `1px solid ${border}`,
                borderRadius: 14,
                padding: "14px 16px",
                background: "#FBFDFF",
                minHeight: 72,
                display: "flex",
                flexDirection: "column",
                gap: 6,
                breakInside: "avoid",
                flex: "1 1 30%",
              }}
            >
              <span style={{ fontSize: 13, color: muted, letterSpacing: 0.2 }}>
                {item.label}
              </span>
              <strong
                style={{
                  fontFamily: stackSans,
                  fontSize: 18,
                  fontWeight: 650,
                  color: text,
                  lineHeight: 1.3,
                }}
              >
                {item.value}
              </strong>
            </div>
          ))}
        </div>

        {/* Tabla */}
        <div
          style={{
            position: "relative",
            border: `1px solid ${border}`,
            borderRadius: 16,
            overflow: "hidden",
            background: "#FFFFFF",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "space-between",
              padding: "14px 16px",
              background: "#F8FAFC",
              borderBottom: `1px solid ${border}`,
              fontFamily: stackSans,
              fontSize: 14,
              fontWeight: 700,
              color: text,
            }}
          >
            <span>Concepto</span>
            <span style={{ minWidth: 200, textAlign: "right" }}>Importe</span>
          </div>
          {items.map((it, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                flexDirection: "row",
                justifyContent: "space-between",
                padding: "14px 16px",
                borderBottom:
                  idx === items.length - 1 ? "none" : `1px solid ${border}`,
                fontSize: 15,
                color: text,
              }}
            >
              <span style={{ lineHeight: 1.5, flex: 1, paddingRight: 12 }}>
                {it.description}
              </span>
              <span
                style={{
                  minWidth: 200,
                  textAlign: "right",
                  fontFamily: stackSans,
                  fontWeight: 650,
                  ...currencyStyle,
                }}
              >
                {peso(it.amount, currency)}
              </span>
            </div>
          ))}
          {items.length === 0 ? (
            <div
              style={{
                padding: "14px 16px",
                fontSize: 15,
                color: muted,
              }}
            >
              Sin conceptos
            </div>
          ) : null}
        </div>

        {/* Total */}
        <div
          style={{
            position: "relative",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <div
            style={{
              minWidth: 320,
              padding: "18px 20px",
              borderRadius: 16,
              border: `1px solid ${border}`,
              background: "#F8FEFF",
              boxShadow: "0px 10px 30px rgba(15,23,42,0.06)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontFamily: stackSans, fontSize: 16, color: muted }}>
              Total
            </span>
            <span
              style={{
                fontFamily: stackSans,
                fontSize: 28,
                fontWeight: 750,
                color: primary,
                ...currencyStyle,
              }}
            >
              {peso(total, currency)}
            </span>
          </div>
        </div>

        {/* Notas */}
        <div
          style={{
            position: "relative",
            padding: "6px 0",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <h2
            style={{
              fontFamily: stackSans,
              fontSize: 18,
              color: text,
              margin: 0,
            }}
          >
            Detalles y condiciones
          </h2>
          {notes ? (
            <p
              style={{
                fontSize: 15,
                color: muted,
                lineHeight: 1.5,
                margin: 0,
                whiteSpace: "pre-wrap",
              }}
            >
              {notes}
            </p>
          ) : null}
        </div>

        {/* Footer */}
        <div
          style={{
            position: "relative",
            display: "flex",
            justifyContent: "center",
            paddingTop: 8,
          }}
        >
          <small
            style={{ fontSize: 13, color: "#94A3B8", textAlign: "center" }}
          >
            Precio no incluye IVA ni comisión. Sujeto a condiciones del
            servicio.
          </small>
        </div>
      </div>
    </div>
  );
}
