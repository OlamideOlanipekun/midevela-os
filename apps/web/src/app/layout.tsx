
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

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
      <body>
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  );
}
