import Link from "next/link";

export default function YakindaSayfasi() {
  return (
    <div className="max-w-lg mx-auto px-4 py-24 text-center">
      <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-3">Bu özellik yakında aktif olacak</h1>
      <p className="text-gray-500 mb-8">
        Bu bölüm şu anda geçici olarak devre dışı. Kısa süre içinde tekrar hizmetinizde olacak.
      </p>
      <Link
        href="/"
        className="inline-block bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl hover:bg-blue-800 transition-colors"
      >
        Ana Sayfaya Dön
      </Link>
    </div>
  );
}
