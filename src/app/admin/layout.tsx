import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gray-900 text-white px-6 py-3 flex items-center gap-6">
        <span className="font-bold text-base tracking-tight">İhaleTR Admin</span>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/admin/danismanlar" className="text-gray-300 hover:text-white transition-colors">
            Destek Uzmanları
          </Link>
        </nav>
        <Link href="/" className="ml-auto text-gray-400 hover:text-white text-sm transition-colors">
          ← Siteye Dön
        </Link>
      </header>
      <main>{children}</main>
    </div>
  );
}
