import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // Expose VAPID public key to the client
    NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY: process.env.WEB_PUSH_VAPID_PUBLIC_KEY,
  },
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
  async rewrites() {
    return [
      // Reescrituras internas para compat con paths previos (evita loops por case-insensitive redirects)
      { source: '/images/Handi-Tools-and-Hardware-Pattern.png', destination: '/images/handi-tools-and-hardware-pattern.png' },
      { source: '/images/handi-Tools-and-Hardware-Pattern.png', destination: '/images/handi-tools-and-hardware-pattern.png' },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
  typescript: {
    // Allow production builds despite TS type errors
    ignoreBuildErrors: true,
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
    // --- Mitigar serialización de strings grandes en cache de Webpack ---
    // 1) Forzar ciertos tipos de assets a emitirse como archivo (asset/resource)
    //    para evitar inlines grandes en el bundle/cache.
    const resourceTest = /\.(svg|txt|md|csv|geojson|ya?ml)$/i;
    config.module.rules = config.module.rules || [];
    config.module.rules.push({
      test: resourceTest,
      type: 'asset/resource',
      generator: {
        filename: 'static/assets/[name].[contenthash][ext]'
      }
    });

    // 2) Bajar el tamaño máximo de inline a 4KB para reglas "asset" existentes
    const lowerInlineLimit = (rule) => {
      if (!rule) return;
      if (Array.isArray(rule.oneOf)) {
        rule.oneOf.forEach(lowerInlineLimit);
      }
      if (Array.isArray(rule.rules)) {
        rule.rules.forEach(lowerInlineLimit);
      }
      if (rule.type === 'asset') {
        rule.parser = {
          ...(rule.parser || {}),
          dataUrlCondition: {
            ...(rule.parser?.dataUrlCondition || {}),
            maxSize: 4 * 1024,
          },
        };
      }
      // Asegurar que .svg no sea capturado por reglas de imágenes previas
      if (rule.test && rule.test instanceof RegExp && rule.test.test('.svg')) {
        rule.exclude = ([]).concat(rule.exclude || [], [/\.svg$/i]);
      }
    };
    (config.module.rules || []).forEach(lowerInlineLimit);

    return config;
  },
};

export default nextConfig;
