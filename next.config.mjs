import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
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
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(process.cwd()), // alias a la raíz del repo
    };
    return config;
  },
};

export default nextConfig;
