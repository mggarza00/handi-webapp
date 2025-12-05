import AddressesList from "./AddressesList.client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import createClient from "@/utils/supabase/server";

type Row = {
  id: string;
  address: string;
  city: string | null;
  postal_code: string | null;
  label: string | null;
  times_used: number;
  last_used_at: string;
  readOnly?: boolean;
};

export default async function AddressesCard() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id || null;
  if (!userId) return null;

  // Read last 20 saved addresses for the user
  const [{ data: legacy }, { data: saved }] = await Promise.all([
    supabase
      .from("user_addresses")
      .select("id,address,city,postal_code,label,times_used,last_used_at")
      .eq("profile_id", userId)
      .order("last_used_at", { ascending: false })
      .limit(20),
    supabase
      .from("user_saved_addresses")
      .select("id,address_line,label,last_used_at,times_used")
      .eq("user_id", userId)
      .order("last_used_at", { ascending: false })
      .limit(20),
  ]);

  const legacyRows: Row[] = Array.isArray(legacy) ? (legacy as Row[]) : [];
  const savedRows: Row[] = Array.isArray(saved)
    ? (saved as Array<{
        id: string;
        address_line: string;
        label: string | null;
        last_used_at: string | null;
        times_used: number | null;
      }>)
        .filter(Boolean)
        .map((r) => ({
          id: r.id,
          address: r.address_line,
          city: null,
          postal_code: null,
          label: r.label,
          times_used: r.times_used ?? 0,
          last_used_at: r.last_used_at ?? "",
          readOnly: true,
        }))
    : [];

  const rows: Row[] = [...savedRows, ...legacyRows];

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="text-xl">Direcciones</CardTitle>
      </CardHeader>
      <CardContent>
        <AddressesList initialItems={rows} />
      </CardContent>
    </Card>
  );
}
