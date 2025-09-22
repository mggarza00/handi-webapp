export type OfferStatus = "sent" | "accepted" | "rejected" | "expired" | "canceled" | "paid";

export interface Offer {
  id: string;
  conversation_id: string;
  client_id: string;
  professional_id: string;
  title: string;
  description?: string | null;
  service_date?: string | null;
  currency: string;
  amount: number;
  status: OfferStatus;
  reject_reason?: string | null;
  checkout_url?: string | null;
  payment_intent_id?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  created_by: string;
  updated_at: string;
  accepting_at?: string | null;
}
