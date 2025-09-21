/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow remote images from Google profile photos
  images: {
    domains: ["lh3.googleusercontent.com"],
  },
  // Keep ESLint active during production builds
  eslint: {
    ignoreDuringBuilds: false,
  },
  // Be explicit about TS behavior in builds
  typescript: {
    ignoreBuildErrors: false,
  },
  webpack: (config, { dev }) => {
    // Avoid webpack persistent file cache issues on OneDrive/Windows
    if (dev) {
      config.cache = { type: "memory" };
      // Use polling so changes are reliably detected under OneDrive/Network FS
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    // Provide a safe stub for optional 'heic2any' to avoid build/type errors
    const path = require("path");
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      heic2any: path.resolve(__dirname, "lib/heic2any-stub.ts"),
    };

    return config;
  },
  // Improve file watching in OneDrive/Network FS environments (dev only)
  // Next.js no longer supports `webpackDevMiddleware`; apply watchOptions via `webpack` instead
  // and consider setting env vars: CHOKIDAR_USEPOLLING=1, CHOKIDAR_INTERVAL=1000
};

module.exports = nextConfig;
