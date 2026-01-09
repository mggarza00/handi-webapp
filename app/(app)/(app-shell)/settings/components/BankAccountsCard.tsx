import ProBankAccountsManager from "./ProBankAccountsManager.client";

import getServerClient from "@/lib/supabase/server-client";

type Props = { userId: string; fullName: string };

export default async function BankAccountsCard({ userId, fullName }: Props) {
  const supabase = getServerClient();
  const { data: rows } = await supabase
    .from("bank_accounts")
    .select("id, bank_name, clabe, status, created_at")
    .eq("profile_id", userId)
    .order("created_at", { ascending: false });

  const initialItems = (rows ?? []).map((r) => {
    const obj = r as unknown as Record<string, unknown>;
    const raw = String(obj.clabe ?? "").replace(/\D+/g, "");
    const first3 = raw.slice(0, 3);
    const last4 = raw.slice(-4);
    const stars = raw ? "*".repeat(Math.max(0, raw.length - 7)) : "";
    return {
      id: String(obj.id ?? ""),
      bank_name:
        typeof obj.bank_name === "string" ? (obj.bank_name as string) : null,
      clabe_masked: raw ? `${first3}${stars}${last4}` : null,
      status: String(obj.status ?? ""),
      is_default: String(obj.status ?? "") === "confirmed",
    };
  });

  return (
    <div className="rounded-2xl border p-4 md:p-6">
      <ProBankAccountsManager
        profileFullName={fullName}
        initialItems={initialItems}
      />
    </div>
  );
}
