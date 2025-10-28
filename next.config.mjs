import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Permite usar paquetes nativos en el servidor sin que Webpack intente empacarlos
    serverComponentsExternalPackages: [
      '@resvg/resvg-js',
    ],
  },
  async headers() {
    return [
      // Ensure proper negotiation and caching for CSS assets
      {
        source: "/:path*.css",
        headers: [
          { key: "Vary", value: "Accept-Encoding" },
          { key: "Content-Type", value: "text/css; charset=utf-8" },
          // Explicitly prevent sniffing issues on older Safari proxies
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        source: "/_next/static/css/:path*",
        headers: [
          { key: "Vary", value: "Accept-Encoding" },
          { key: "Content-Type", value: "text/css; charset=utf-8" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // Migración: redirige rutas antiguas de /messages a /mensajes
      { source: '/messages', destination: '/mensajes', permanent: true },
      { source: '/messages/:id', destination: '/mensajes/:id', permanent: true },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
  eslint: {
    // Allow production builds to succeed even if there are ESLint errors.
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(process.cwd()), // alias a la raíz del repo
    };
    // Evita que Webpack intente parsear el binario nativo de resvg
    if (isServer) {
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push('@resvg/resvg-js');
      }
    }
    return config;
  },
};

export default nextConfig;
