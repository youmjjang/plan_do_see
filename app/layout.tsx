import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "큐티스트릿도 다이어리",
  description: "유미의 주말 섬 꾸미기 — 계획, 플레이 기록, 돌아보기",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
