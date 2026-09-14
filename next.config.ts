import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    optimizePackageImports: ['@mantine/core', '@mantine/hooks'],
  },
  serverExternalPackages: ['@rhwp/core'],
  turbopack: {},
};

export default nextConfig;
