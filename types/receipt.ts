export type ServerReceipt = {
  receiptId: string; // RCPT-2025-000123
  createdAtISO: string; // ISO date-time
  customer: {
    name: string;
    email?: string | null;
    phone?: string | null;
  };
  service: {
    title: string;
    requestId: string;
    professionalName?: string | null;
    dateISO?: string | null; // service date (optional)
  };
  payment: {
    method?: string | null; // e.g. 'card'
    brand?: string | null; // e.g. 'visa'
    last4?: string | null; // e.g. '4242'
    // Total directo (cuando no se mandan items/subtotal/tax)
    amountMXN?: number; // MXN o centavos si amountIsCents=true
    amountIsCents?: boolean;
    paymentIntentId?: string | null; // Stripe PI
    sessionId?: string | null; // Stripe Checkout Session
    items: Array<{
      description: string;
      quantity?: number;
      unitPrice?: number; // MXN
      amount: number; // MXN
    }>;
    subtotal: number; // MXN
    tax?: number; // MXN
    total: number; // MXN
    currency?: string; // default MXN
    notes?: string | null;
  };
  business?: {
    name: string;
    website?: string | null;
    legalName?: string | null;
    rfc?: string | null; // legacy RFC
    taxInfo?: string | null; // RFC si aplica (alias)
    logoUrl?: string | null;
    address?: {
      line1: string;
      line2?: string | null;
      city?: string | null;
      state?: string | null;
      postalCode?: string | null;
    } | null;
    addressText?: string | null; // dirección en texto plano
    supportEmail?: string | null;
    supportPhone?: string | null;
  } | null;
  meta?: Record<string, string> | null;
};
