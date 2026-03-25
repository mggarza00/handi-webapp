import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Handi",
    short_name: "Handi",
    description:
      "Encuentra, conecta y resuelve. Handi, tu app de servicios profesionales.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#00124A",
    theme_color: "#00124A",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/manifest-icon-192.maskable.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/manifest-icon-512.maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/icons/badge-72.png",
        sizes: "72x72",
        type: "image/png",
        purpose: "monochrome",
      },
    ],
  };
}
