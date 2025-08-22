/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // No reescribas /api; deja que el App Router sirva las rutas de app/api/**
  async rewrites() {
    return [
      // ejemplo: ninguna rewrite que afecte /api
    ];
  },
};

module.exports = nextConfig;
