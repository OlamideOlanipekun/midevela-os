import path from "path";
import type { NextConfig } from "next";

// Baseline security headers applied to every response. Deliberately
// conservative: HSTS + anti-clickjacking + sniff/referrer/permissions
// hardening, but NO restrictive script-src CSP (that risks breaking the
// Next.js runtime and is a dedicated follow-up). frame-ancestors 'none'
// gives clickjacking protection without touching script loading, so the
// script-injected widget on merchant sites is unaffected.
const COMMON_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// Default: no framing at all (anti-clickjacking).
const SECURITY_HEADERS = [
  ...COMMON_HEADERS,
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

// The widget-preview harness is intentionally embedded in an <iframe> by
// our own onboarding/settings pages so a merchant can test their live
// widget. It must be same-origin framable — DENY would blank the iframe.
// 'self' still blocks any OTHER origin from framing it, so it stays
// clickjacking-safe.
const SAMEORIGIN_FRAME_HEADERS = [
  ...COMMON_HEADERS,
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
];

const nextConfig: NextConfig = {
  // Monorepo root — prevents Next from guessing the workspace root from
  // stray lockfiles elsewhere on the machine.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // All API routes use Node.js built-ins (dns/promises, crypto/scrypt,
  // Prisma). Ensuring the Node.js runtime is the default prevents Vercel
  // from accidentally bundling these routes for the Edge runtime, which
  // would cause 404s on cold start.
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  serverExternalPackages: ["@prisma/client", "prisma"],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  async headers() {
    return [
      // widget-preview must be same-origin framable (see above). Listed
      // first and excluded from the DENY rule below so only ONE
      // X-Frame-Options value is ever sent for it.
      { source: "/widget-preview", headers: SAMEORIGIN_FRAME_HEADERS },
      // Everything else: no framing. Negative lookahead keeps widget-preview
      // out of this rule so it never gets a conflicting DENY header.
      { source: "/((?!widget-preview).*)", headers: SECURITY_HEADERS },
    ];
  },
};

export default nextConfig;
