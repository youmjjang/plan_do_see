import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "큐티스트릿도 다이어리",
  description: "나만의 계획, 할 일, 실행 기록과 돌아보기를 관리하는 개인 다이어리",
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
