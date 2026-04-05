import type { Metadata } from "next";
import "./globals.css";
import PublicShell from "@/components/PublicShell";
import { UserProvider } from "@/components/UserContext";

export const metadata: Metadata = {
  title: "SUP Wiki — 桨板运动资讯百科",
  description: "SUP Wiki 提供桨板品牌、产品、运动员、博主和赛事的权威资讯。",
  keywords: ["SUP", "桨板", "Stand Up Paddle", "水上运动", "桨板品牌"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-full flex flex-col bg-cream-100" style={{ fontFamily: "var(--font-sans)" }}>
        <UserProvider>
          <PublicShell>{children}</PublicShell>
        </UserProvider>
      </body>
    </html>
  );
}
