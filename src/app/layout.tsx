import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { PortfolioProvider } from "@/contexts/PortfolioContext";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Alpha-Vibe | AI Investment Agent",
  description: "AI 기반 금융 투자 에이전트 터미널",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased overflow-hidden`}
      >
        <PortfolioProvider>{children}</PortfolioProvider>
      </body>
    </html>
  );
}
