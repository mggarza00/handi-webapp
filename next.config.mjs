/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // Evita problemas de caché en Windows/OneDrive
      config.cache = false;
    }
    return config;
  },
};
export default nextConfig;
