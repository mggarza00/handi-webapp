import { ufetch } from "@/lib/http";

export const dynamic = "force-dynamic";

export default async function Page() {
  const res = await ufetch("/api/applications/my", {
    method: "GET",
    noStore: true,
    forwardCookies: true,
  });

  if (!res.ok) {
    // Captura error del endpoint y lo hace visible
    const text = await res.text().catch(() => "");
    throw new Error(`GET /api/applications/my → ${res.status} ${res.statusText}\n${text}`);
  }

  const data = await res.json();
  return <pre className="p-4 text-sm overflow-auto">{JSON.stringify(data, null, 2)}</pre>;
}
