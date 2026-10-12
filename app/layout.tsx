import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./green-theme.css";
import "./ledger-recording.css";
import { PwaBootstrap } from "./pwa-client";

export const metadata: Metadata = {
  title: "有余 · 生活费规划",
  description: "分配好每一笔生活费，慢慢靠近想要的生活。",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "有余", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/pwa/icon-192.png", sizes: "192x192", type: "image/png" }],
    shortcut: "/pwa/icon-192.png",
    apple: "/pwa/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#008e64",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased"><PwaBootstrap />{children}</body>
    </html>
  );
}
