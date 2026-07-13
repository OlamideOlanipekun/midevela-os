import path from "path";
import type { NextConfig } from "next";

// Baseline security headers applied to every response. Deliberately
// conservative: HSTS + anti-clickjacking + sniff/referrer/permissions
// hardening, but NO restrictive script-src CSP (that risks breaking the
// Next.js runtime and is a dedicated follow-up). frame-ancestors 'none'
// gives clickjacking protection without touching script loading, so the
// script-injected widget on merchant sites is unaffected.
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

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
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
