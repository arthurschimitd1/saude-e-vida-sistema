import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    externalDir: true,
  },
  webpack(config) {
    config.resolve.modules = [
      path.join(path.dirname(new URL(import.meta.url).pathname), 'node_modules'),
      ...(config.resolve.modules ?? []),
    ];
    return config;
  },
};

export default nextConfig;
