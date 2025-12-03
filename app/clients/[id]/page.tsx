import ClientProfileView from "./ClientProfileView";

import { getClientData } from "@/lib/clients/get-client-data";

type Params = { params: { id: string } };

export const dynamic = "force-dynamic";

export default async function ClientProfilePage({ params }: Params) {
  // Server-side data aggregation via Supabase admin

  const data = await getClientData(params.id);
  return <ClientProfileView data={data} />;
}
