import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.env.INIT_CWD
    ? undefined
    : undefined,
};

export default nextConfig;
