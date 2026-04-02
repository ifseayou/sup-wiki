import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PublicShell from "@/components/PublicShell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SUP Wiki - 桨板资讯百科",
  description: "SUP Wiki 是一个桨板运动资讯平台，提供品牌、产品、运动员、博主和赛事信息。",
  keywords: ["SUP", "桨板", "Stand Up Paddle", "水上运动", "品牌", "产品"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-cream-100">
        <PublicShell>{children}</PublicShell>
      </body>
    </html>
  );
}
