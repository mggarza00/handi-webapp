import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "http://localhost:3000";
  const routes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: new Date() },
    { url: `${base}/help`, lastModified: new Date() },
    { url: `${base}/requests`, lastModified: new Date() },
    { url: `${base}/requests/new`, lastModified: new Date() },
    { url: `${base}/search`, lastModified: new Date() },
  ];

  try {
    const res = await fetch(`${base}/api/requests?status=active`, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
      cache: "no-store",
    });
    if (res.ok) {
      const j = await res.json();
      const list: Array<{ id: string; created_at?: string | null }> =
        j?.data ?? [];
      for (const r of list.slice(0, 50)) {
        routes.push({
          url: `${base}/requests/${r.id}`,
          lastModified: r.created_at ? new Date(r.created_at) : new Date(),
        });
      }
    }
  } catch {
    // ignore network errors
  }

  return routes;
}
