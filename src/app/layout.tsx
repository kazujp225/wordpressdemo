import type { Metadata } from "next";
import { Noto_Sans_JP, Manrope } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/Toaster";

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-noto-sans-jp",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "LP Builder",
  description: "Vertical LP Builder",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className={`${notoSansJP.variable} ${manrope.variable} font-sans antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
