import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-lg mx-auto px-4 py-24 text-center">
      <p className="text-blue-700 font-bold text-6xl mb-4">404</p>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Sayfa bulunamadı</h1>
      <p className="text-gray-500 mb-8">
        Aradığınız sayfa kaldırılmış, taşınmış ya da hiç var olmamış olabilir.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl hover:bg-blue-800 transition-colors"
      >
        Ana Sayfaya Dön
      </Link>
    </div>
  );
}
