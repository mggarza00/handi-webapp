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
};

export default async function AddressesCard() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id || null;
  if (!userId) return null;

  // Read last 20 saved addresses for the user
  const { data } = await supabase
    .from("user_addresses")
    .select("id,address,city,postal_code,label,times_used,last_used_at")
    .eq("profile_id", userId)
    .order("last_used_at", { ascending: false })
    .limit(20);
  const rows: Row[] = Array.isArray(data) ? (data as Row[]) : [];

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
