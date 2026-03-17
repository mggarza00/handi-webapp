import type { MetadataRoute } from "next";

import {
  ACTIVE_SERVICE_CITY_COMBINATIONS,
  SEO_CITIES,
  SEO_SERVICES,
} from "@/lib/seo/local-landings";
import { getAppBaseUrl } from "@/lib/seo/site-url";
import { getAdminSupabase } from "@/lib/supabase/admin";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getAppBaseUrl();
  const now = new Date();
  const routes: MetadataRoute.Sitemap = [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${base}/professionals`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${base}/help`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${base}/servicios`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${base}/ciudades`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${base}/privacy`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${base}/terms-and-conditions`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${base}/politicas-facturacion`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];

  for (const service of SEO_SERVICES) {
    routes.push({
      url: `${base}/servicios/${service.slug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.75,
    });
  }

  for (const city of SEO_CITIES) {
    routes.push({
      url: `${base}/ciudades/${city.slug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.65,
    });
  }

  for (const combo of ACTIVE_SERVICE_CITY_COMBINATIONS) {
    routes.push({
      url: `${base}/servicios/${combo.serviceSlug}/${combo.citySlug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  try {
    const supabase = getAdminSupabase();
    const { data: professionals, error } = await supabase
      .from("professionals")
      .select("id, updated_at, created_at")
      .eq("active", true)
      .limit(2000);

    if (error) throw error;

    type SitemapProfessional = {
      id: string;
      updated_at: string | null;
      created_at: string | null;
    };
    const professionalRows =
      (professionals as SitemapProfessional[] | null | undefined) ?? [];

    for (const professional of professionalRows) {
      routes.push({
        url: `${base}/profiles/${professional.id}`,
        lastModified: professional.updated_at
          ? new Date(professional.updated_at)
          : professional.created_at
            ? new Date(professional.created_at)
            : now,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  } catch {
    // Ignore dynamic profile errors and return static public URLs.
  }

  return routes;
}
