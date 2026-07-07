import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Monorepo root — prevents Next from guessing the workspace root from
  // stray lockfiles elsewhere on the machine.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};

export default nextConfig;
