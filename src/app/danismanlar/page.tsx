import Link from "next/link";

const OZELLIKLER = [
  { ikon: "⚡", baslik: "Hızlı Yanıt",   aciklama: "Destek talepleriniz ekibimiz tarafından en kısa sürede değerlendirilir" },
  { ikon: "📚", baslik: "Kapsamlı SSS",  aciklama: "Platformun işleyişiyle ilgili en çok sorulan sorular tek sayfada" },
  { ikon: "🔒", baslik: "Güvenilir Destek", aciklama: "Hesap, ödeme ve ihale süreçleriyle ilgili tüm konularda yanınızdayız" },
];

const KARTLAR = [
  {
    href: "/sss",
    ikon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
    renk: "bg-blue-50 group-hover:bg-blue-700 text-blue-700",
    baslik: "Sık Sorulan Sorular",
    aciklama: "Üyelik planları, teklif ücretlendirmesi, ihale süreleri ve daha fazlası hakkında hazır yanıtlara göz atın.",
    aksiyon: "SSS Sayfasına Git",
  },
  {
    href: "/iletisim",
    ikon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    ),
    renk: "bg-green-50 group-hover:bg-green-600 text-green-700",
    baslik: "İletişim Bilgilerimize Ulaşın",
    aciklama: "Telefon, e-posta ve ofis adresimiz için iletişim sayfamızı ziyaret edin, ekibimize doğrudan ulaşın.",
    aksiyon: "İletişim Sayfasına Git",
  },
];

export default function DestekSayfasi() {
  return (
    <div>
      {/* ─── Hero ─── */}
      <section className="bg-gradient-to-br from-blue-800 to-blue-950 text-white py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-block text-xs font-bold bg-blue-700/60 text-blue-200 px-3 py-1 rounded-full mb-5 tracking-wide uppercase">
            Destek Merkezi
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
            Destek ve İletişim
          </h1>
          <p className="text-blue-100 text-base leading-relaxed max-w-2xl mx-auto">
            İhaleTR&apos;yi kullanırken aklınıza takılan her şey için buradayız — sık sorulan sorulardan
            doğrudan iletişime kadar tüm destek kanallarımız tek sayfada.
          </p>
        </div>
      </section>

      {/* ─── Özellik bandı ─── */}
      <section className="bg-white border-b border-gray-100 py-8 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6">
          {OZELLIKLER.map((o) => (
            <div key={o.baslik} className="flex items-start gap-4 p-4">
              <span className="text-2xl flex-shrink-0">{o.ikon}</span>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm mb-1">{o.baslik}</h3>
                <p className="text-gray-500 text-xs leading-relaxed">{o.aciklama}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Destek kanalları ─── */}
      <section className="py-12 px-4 bg-gray-50 min-h-[60vh]">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Size Nasıl Yardımcı Olabiliriz?</h2>
            <p className="text-gray-500 text-sm">Aşağıdaki kanallardan size en uygun olanı seçin</p>
          </div>

          <div className="flex flex-col gap-5">
            {KARTLAR.map((k) => (
              <Link
                key={k.href}
                href={k.href}
                className="group flex flex-col gap-4 bg-white border-2 border-gray-200 hover:border-blue-400 rounded-2xl p-7 shadow-sm hover:shadow-md transition-all text-left"
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors flex-shrink-0 ${k.renk}`}>
                  <svg className="w-7 h-7 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {k.ikon}
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base mb-1.5 group-hover:text-blue-700 transition-colors">
                    {k.baslik}
                  </h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{k.aciklama}</p>
                </div>
                <span className="text-blue-600 text-sm font-semibold flex items-center gap-1 mt-auto">
                  {k.aksiyon}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </Link>
            ))}

            {/* Hızlı iletişim özeti */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Canlı Destek Saatleri</p>
                <p className="text-gray-900 font-semibold">Hafta içi 09:00 – 18:00</p>
              </div>
              <a
                href="tel:+908501234567"
                className="bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-blue-800 transition-colors text-sm whitespace-nowrap"
              >
                0850 123 45 67
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
