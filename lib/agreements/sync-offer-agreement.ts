import { getAdminSupabase } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";

type OfferRow = Database["public"]["Tables"]["offers"]["Row"];

type SyncArgs = {
  offer: OfferRow;
  status: "accepted" | "rejected";
};

function mapAgreementStatus(status: SyncArgs["status"]) {
  return status === "accepted" ? "accepted" : "cancelled";
}

export async function syncOfferAgreementStatus({ offer, status }: SyncArgs) {
  try {
    const admin = getAdminSupabase();
    const proId = (offer as { professional_id?: string | null })
      .professional_id;
    let requestId = (offer as { request_id?: string | null }).request_id;
    if (!requestId) {
      const conversationId = (offer as { conversation_id?: string | null })
        .conversation_id;
      if (conversationId) {
        const { data: conv, error: convError } = await admin
          .from("conversations")
          .select("request_id")
          .eq("id", conversationId)
          .maybeSingle();
        if (convError && process.env.NODE_ENV !== "production") {
          console.error("syncOfferAgreementStatus conv lookup failed", convError);
        }
        requestId =
          (conv as { request_id?: string | null } | null)?.request_id ?? null;
      }
    }

    if (!requestId || !proId) {
      if (process.env.NODE_ENV !== "production") {
        console.error("syncOfferAgreementStatus missing ids", {
          requestId,
          proId,
        });
      }
      return;
    }

    const now = new Date().toISOString();
    const amountRaw = Number((offer as { amount?: number | null }).amount);
    const amount = Number.isFinite(amountRaw) ? amountRaw : null;
    const nextStatus = mapAgreementStatus(status);

    const { data: existing, error: existingError } = await admin
      .from("agreements")
      .select("id")
      .eq("request_id", requestId)
      .eq("professional_id", proId)
      .maybeSingle();
    if (existingError && process.env.NODE_ENV !== "production") {
      console.error("syncOfferAgreementStatus read failed", existingError);
    }

    if (existing?.id) {
      const patch: Record<string, unknown> = {
        status: nextStatus as any,
        updated_at: now,
      };
      if (amount !== null) patch.amount = amount;
      const { error: updateError } = await admin
        .from("agreements")
        .update(patch)
        .eq("id", existing.id);
      if (updateError && process.env.NODE_ENV !== "production") {
        console.error("syncOfferAgreementStatus update failed", updateError);
      }
      return;
    }

    const { error: insertError } = await admin.from("agreements").insert({
      request_id: requestId,
      professional_id: proId,
      amount,
      status: nextStatus as any,
      created_at: now,
      updated_at: now,
    });
    if (insertError && process.env.NODE_ENV !== "production") {
      console.error("syncOfferAgreementStatus insert failed", insertError);
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("syncOfferAgreementStatus failed", error);
    }
  }
}
