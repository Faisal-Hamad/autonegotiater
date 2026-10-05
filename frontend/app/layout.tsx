import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "AutoNegotiater",
  description: "AI-powered automated negotiation for C2C marketplaces",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <header className="border-b bg-white sticky top-0 z-50">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-xl font-bold tracking-tight text-indigo-600 hover:text-indigo-700">
              AutoNegotiater
            </Link>
            <div className="flex items-center gap-6 text-sm font-medium">
              <Link href="/products" className="text-slate-600 hover:text-indigo-600 transition">
                Products
              </Link>
              <span className="text-slate-200">|</span>
              <Link href="/dashboard/seller" className="text-slate-600 hover:text-indigo-600 transition">
                Seller
              </Link>
              <Link href="/dashboard/buyer" className="text-slate-600 hover:text-indigo-600 transition">
                Buyer
              </Link>
              <Link href="/dashboard/admin" className="text-slate-600 hover:text-indigo-600 transition">
                Admin
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}