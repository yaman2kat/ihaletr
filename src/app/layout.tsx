import type { Metadata } from "next";
import Link from "next/link";
import { Geist } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "İhaleTR - Türkiye İhale Platformu",
  description: "Türkiye'nin dijital ihale platformu. İhaleleri keşfedin, teklif verin.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-gray-50">
        <Navbar />
        <main className="flex-1">{children}</main>
        <footer className="bg-gray-800 text-gray-300 py-8 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center gap-4">
            <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
              <Link href="/ihaleler" className="hover:text-white transition-colors">İhaleler</Link>
              <Link href="/danismanlar" className="hover:text-white transition-colors">Destek</Link>
              <Link href="/sss" className="hover:text-white transition-colors">SSS</Link>
              <Link href="/iletisim" className="hover:text-white transition-colors">İletişim</Link>
            </nav>
            <p className="text-sm text-gray-400">© 2024 İhaleTR. Tüm hakları saklıdır.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
