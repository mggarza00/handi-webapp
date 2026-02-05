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
    const requestId = (offer as { request_id?: string | null }).request_id;
    const proId = (offer as { professional_id?: string | null })
      .professional_id;
    if (!requestId || !proId) return;

    const admin = getAdminSupabase();
    const now = new Date().toISOString();
    const amountRaw = Number((offer as { amount?: number | null }).amount);
    const amount = Number.isFinite(amountRaw) ? amountRaw : null;
    const nextStatus = mapAgreementStatus(status);

    const { data: existing } = await admin
      .from("agreements")
      .select("id")
      .eq("request_id", requestId)
      .eq("professional_id", proId)
      .maybeSingle();

    if (existing?.id) {
      const patch: Record<string, unknown> = {
        status: nextStatus as any,
        updated_at: now,
      };
      if (amount !== null) patch.amount = amount;
      await admin.from("agreements").update(patch).eq("id", existing.id);
      return;
    }

    await admin.from("agreements").insert({
      request_id: requestId,
      professional_id: proId,
      amount,
      status: nextStatus as any,
      created_at: now,
      updated_at: now,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("syncOfferAgreementStatus failed", error);
    }
  }
}
