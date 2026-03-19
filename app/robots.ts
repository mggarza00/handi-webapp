import type { MetadataRoute } from "next";

import { getAppBaseUrl, isLocalBaseUrl } from "@/lib/seo/site-url";

export default function robots(): MetadataRoute.Robots {
  const base = getAppBaseUrl();
  if (isLocalBaseUrl(base)) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
      sitemap: `${base}/sitemap.xml`,
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/help",
          "/privacy",
          "/terms-and-conditions",
          "/politicas-facturacion",
          "/professionals",
          "/profiles/",
          "/servicios",
          "/servicios/",
          "/ciudades",
          "/ciudades/",
        ],
        disallow: [
          "/admin",
          "/api",
          "/auth",
          "/messages",
          "/mensajes",
          "/notifications",
          "/profile/",
          "/settings/",
          "/requests/new",
          "/requests/",
          "/pro",
          "/landing",
          "/favorites",
          "/applied",
          "/pagos",
          "/receipts",
          "/recibos",
          "/dev",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
