import ClientProfileView from "./ClientProfileView";

import { normalizeClientProfileId } from "@/lib/clients/client-profile-link";
import { getClientData } from "@/lib/clients/get-client-data";

type Params = { params: { id: string } };

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEBUG_CLIENT_PROFILE = process.env.DEBUG_CLIENT_PROFILE === "1";

export default async function ClientProfilePage({ params }: Params) {
  const normalizedClientId = normalizeClientProfileId(params.id);
  if (DEBUG_CLIENT_PROFILE) {
    console.log("[clients/page] request", {
      rawClientId: params.id,
      normalizedClientId,
    });
  }

  const data = await getClientData(params.id);

  if (DEBUG_CLIENT_PROFILE) {
    console.log("[clients/page] result", {
      rawClientId: params.id,
      normalizedClientId,
      resolvedProfileId: data.profile?.id ?? null,
      requestsCount: data.requests.length,
      reviewsCount: data.recentReviews.length,
    });
  }

  return <ClientProfileView data={data} />;
}
