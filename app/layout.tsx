import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Shantell_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { getCanonicalAuthOrigin } from "@/lib/authUrls";
import { Providers } from "./providers";
import "./globals.css";

const shantellSans = Shantell_Sans({
  subsets: ["latin"],
  variable: "--font-shantell-sans",
  weight: ["400", "500", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getCanonicalAuthOrigin()),
  applicationName: "Paapan AI",
  title: {
    default: "Paapan AI",
    template: "%s | Paapan AI",
  },
  description:
    "Paapan AI adalah workspace visual berbasis canvas untuk ide, board, gambar, dan AI dalam satu ruang kerja modern.",
  icons: {
    icon: "/brand/icon/paapan-mark.png",
    shortcut: "/brand/icon/paapan-mark.png",
    apple: "/brand/icon/paapan-mark.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} ${shantellSans.variable} antialiased font-sans`}
        suppressHydrationWarning
      >
        <Providers>
          {children}
          <Analytics />
          <SpeedInsights />
        </Providers>
      </body>
    </html>
  );
}
