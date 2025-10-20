import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Permite usar paquetes nativos en el servidor sin que Webpack intente empacarlos
    serverComponentsExternalPackages: [
      '@resvg/resvg-js',
    ],
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
