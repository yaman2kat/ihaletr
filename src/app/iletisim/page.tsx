import Link from "next/link";

export default function IletisimSayfasi() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-8">
        <Link href="/" className="hover:text-blue-700">Ana Sayfa</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">İletişim</span>
      </nav>

      <div className="text-center mb-10">
        <span className="inline-block text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full mb-4 tracking-wide uppercase">
          İletişim
        </span>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Bize Ulaşın</h1>
        <p className="text-gray-500 text-base max-w-lg mx-auto">
          Sistem hakkında sorularınız için aşağıdaki kanallardan bize ulaşabilirsiniz.
          Ekibimiz en kısa sürede size geri dönecektir.
        </p>
      </div>

      {/* İletişim kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-10">
        <a
          href="tel:+908501234567"
          className="group flex items-start gap-4 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:border-blue-300 hover:shadow-md transition-all"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-700 transition-colors">
            <svg className="w-6 h-6 text-blue-700 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Telefon</p>
            <p className="font-bold text-gray-900 text-lg">0850 123 45 67</p>
            <p className="text-gray-500 text-sm mt-0.5">Hafta içi 09:00 – 18:00</p>
          </div>
        </a>

        <a
          href="mailto:info@ihaletr.com"
          className="group flex items-start gap-4 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:border-blue-300 hover:shadow-md transition-all"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-700 transition-colors">
            <svg className="w-6 h-6 text-blue-700 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">E-posta</p>
            <p className="font-bold text-gray-900 text-lg">info@ihaletr.com</p>
            <p className="text-gray-500 text-sm mt-0.5">Genellikle 1 iş günü içinde yanıtlanır</p>
          </div>
        </a>

        <a
          href="mailto:destek@ihaletr.com"
          className="group flex items-start gap-4 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:border-blue-300 hover:shadow-md transition-all"
        >
          <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0 group-hover:bg-green-600 transition-colors">
            <svg className="w-6 h-6 text-green-700 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Teknik Destek</p>
            <p className="font-bold text-gray-900 text-lg">destek@ihaletr.com</p>
            <p className="text-gray-500 text-sm mt-0.5">Platform sorunları ve kullanım yardımı</p>
          </div>
        </a>

        <div className="flex items-start gap-4 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Adres</p>
            <p className="font-bold text-gray-900">İhaleTR Teknoloji A.Ş.</p>
            <p className="text-gray-500 text-sm mt-0.5 leading-relaxed">
              Maslak Mah. Büyükdere Cad. No:123<br />
              Sarıyer / İstanbul
            </p>
          </div>
        </div>
      </div>

      {/* SSS */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-8">
        <h2 className="text-base font-bold text-gray-900 mb-5">Sık Sorulan Sorular</h2>
        <div className="flex flex-col divide-y divide-gray-100">
          {[
            {
              s: "Danışman atama süreci nasıl işliyor?",
              c: "\"Danışmanla Konuş\" sayfasında inşaat aşamanızı, türünüzü ve konumunuzu seçtikten sonra sistem en uygun danışmanı otomatik olarak önerir. Doğrudan iletişime geçebilirsiniz.",
            },
            {
              s: "Danışmanla görüşmek ücretli mi?",
              c: "İlk iletişim ve bilgi alma ücretsizdir. Denetim hizmeti için danışmanla ayrıca ücret belirlenir.",
            },
            {
              s: "Platforma nasıl ihale ekleyebilirim?",
              c: "Hesabınıza giriş yaptıktan sonra \"İhale Oluştur\" butonundan yeni ihale oluşturabilirsiniz.",
            },
          ].map((faq) => (
            <div key={faq.s} className="py-4 first:pt-0 last:pb-0">
              <p className="text-sm font-semibold text-gray-900 mb-1">{faq.s}</p>
              <p className="text-sm text-gray-500 leading-relaxed">{faq.c}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Geri dön */}
      <div className="flex items-center justify-center gap-4">
        <Link href="/danismanlar"
          className="flex items-center gap-2 text-blue-700 font-semibold hover:underline text-sm">
          ← Danışman Bul
        </Link>
        <span className="text-gray-300">|</span>
        <Link href="/"
          className="text-gray-500 hover:text-blue-700 font-medium text-sm transition-colors">
          Ana Sayfaya Dön
        </Link>
      </div>
    </div>
  );
}
