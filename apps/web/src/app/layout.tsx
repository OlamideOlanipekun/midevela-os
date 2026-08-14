
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { AuthProvider } from "@/components/providers/AuthProvider";
import "./globals.css";

// Initialize event pipeline, metrics service, and queue workers
import "@/server/events/register";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["300", "400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Midevela — AI Commerce Operating System",
  description:
    "Transform your website into an intelligent shopping experience. Midevela understands visitors, guides buying decisions, and increases conversion 24/7.",
  keywords:
    "AI sales agent, AI commerce, WhatsApp automation, ecommerce AI, conversational commerce, Midevela",
  manifest: "/api/widget/manifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Midevela",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        {/* PWA: viewport + theme colour */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#6366f1" />
        {/* PWA: iOS-specific */}
        <link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icon-512.png" />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
        {/* PWA: Service Worker registration — runs client-side only */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function () {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  // Register after load so it does not delay first paint
  window.addEventListener('load', function () {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(function (reg) {
        // Check for updates every 60 seconds (long-lived pages)
        setInterval(function () { reg.update(); }, 60000);
        // Notify clients when a new SW is waiting to take control
        reg.addEventListener('updatefound', function () {
          var newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', function () {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Dispatch custom event so UI can show "update available" banner
              window.dispatchEvent(new CustomEvent('sw:updateavailable'));
            }
          });
        });
      })
      .catch(function (err) {
        // SW is enhancement-only; log but never throw
        console.warn('[Midevela] SW registration failed:', err);
      });
  });
})();
`,
          }}
        />
      </body>
    </html>
  );
}
