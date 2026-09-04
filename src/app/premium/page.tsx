import Link from "next/link";

interface Ozellik {
  metin: string;
  dahil: boolean;
}

interface Plan {
  isim: string;
  fiyat: string;
  fiyatAlt: string;
  aciklama: string;
  renk: string;
  popüler: boolean;
  ctaMetni: string;
  ctaHref: string;
  ozellikler: Ozellik[];
}

const PLANLAR: Plan[] = [
  {
    isim: "Ücretsiz",
    fiyat: "0₺",
    fiyatAlt: "",
    aciklama: "Tek bir ihale açmak ve sistemi keşfetmek için ideal başlangıç noktası.",
    renk: "gray",
    popüler: false,
    ctaMetni: "Mevcut Planınız",
    ctaHref: "/panel",
    ozellikler: [
      { metin: "1 aktif ihale",                      dahil: true  },
      { metin: "Maksimum 5 gün ihale süresi",        dahil: true  },
      { metin: "Standart destek uzmanı eşleştirmesi", dahil: true  },
      { metin: "E-posta desteği",                    dahil: true  },
      { metin: "Süre uzatma",                        dahil: false },
      { metin: "Sınırsız aktif ihale",               dahil: false },
      { metin: "Teklifçi analitikleri",              dahil: false },
      { metin: "Öncelikli destek",                   dahil: false },
    ],
  },
  {
    isim: "Premium",
    fiyat: "499₺",
    fiyatAlt: "/ ay",
    aciklama: "Ciddi arsa sahipleri ve inşaat profesyonelleri için eksiksiz araç seti.",
    renk: "blue",
    popüler: true,
    ctaMetni: "Premium'a Geç",
    ctaHref: "/odeme/premium",
    ozellikler: [
      { metin: "Sınırsız aktif ihale",               dahil: true },
      { metin: "45 güne kadar ihale süresi",         dahil: true },
      { metin: "ekstra 15 güne kadar uzatma",        dahil: true },
      { metin: "Öncelikli destek uzmanı eşleştirmesi", dahil: true },
      { metin: "Teklifçi analitikleri",              dahil: true },
      { metin: "Öncelikli e-posta & telefon desteği", dahil: true },
      { metin: "Çoklu kullanıcı hesabı",             dahil: false },
      { metin: "Özel hesap yöneticisi",              dahil: false },
    ],
  },
  {
    isim: "Kurumsal",
    fiyat: "2.499₺",
    fiyatAlt: "/ ay",
    aciklama: "Büyük ölçekli projeler ve kurumsal müteahhitler için tam güç paketi.",
    renk: "purple",
    popüler: false,
    ctaMetni: "Kurumsal'a Geç",
    ctaHref: "/odeme/kurumsal",
    ozellikler: [
      { metin: "Premium'ın tüm özellikleri",         dahil: true },
      { metin: "60 güne kadar ihale süresi",         dahil: true },
      { metin: "ekstra 30 güne kadar uzatma",        dahil: true },
      { metin: "Çoklu kullanıcı hesabı (10 kişi)",  dahil: true },
      { metin: "Özel destek uzmanı havuzu",          dahil: true },
      { metin: "Özel API entegrasyonu",              dahil: true },
      { metin: "SLA garantisi (%99,9 uptime)",       dahil: true },
      { metin: "Birebir hesap yöneticisi",           dahil: true },
      { metin: "Özel raporlama ve analizler",        dahil: true },
      { metin: "Şirket içi eğitim",                 dahil: true },
    ],
  },
];

function Tik({ dahil }: { dahil: boolean }) {
  return dahil ? (
    <svg className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  ) : (
    <svg className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

const CTA_CLS: Record<string, string> = {
  gray:   "bg-gray-100 text-gray-700 hover:bg-gray-200",
  blue:   "bg-blue-700 text-white hover:bg-blue-800 shadow-md shadow-blue-200",
  purple: "bg-purple-700 text-white hover:bg-purple-800 shadow-md shadow-purple-200",
};

const KART_CLS: Record<string, string> = {
  gray:   "border-gray-200 bg-white",
  blue:   "border-blue-500 bg-white ring-2 ring-blue-500 ring-offset-2",
  purple: "border-purple-200 bg-white",
};

export default function PremiumSayfasi() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

      {/* Başlık */}
      <div className="text-center mb-14">
        <span className="inline-block text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full mb-4 tracking-wide uppercase">
          Premium
        </span>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Planınızı Seçin</h1>
        <p className="text-gray-500 text-lg max-w-xl mx-auto leading-relaxed">
          Ücretsiz başlayın, ihtiyacınız arttıkça yükseltin.
        </p>
      </div>

      {/* Plan Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
        {PLANLAR.map((plan) => (
          <div
            key={plan.isim}
            className={`relative rounded-2xl border p-8 flex flex-col ${KART_CLS[plan.renk]}`}
          >
            {plan.popüler && (
              <div className="absolute -top-3.5 left-0 right-0 flex justify-center">
                <span className="bg-blue-700 text-white text-xs font-bold px-4 py-1 rounded-full shadow">
                  En Popüler
                </span>
              </div>
            )}

            {/* Plan başlık */}
            <div className="mb-6">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{plan.isim}</p>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-bold text-gray-900">{plan.fiyat}</span>
                <span className="text-gray-400 text-sm">{plan.fiyatAlt}</span>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">{plan.aciklama}</p>
            </div>

            {/* CTA */}
            <Link
              href={plan.ctaHref}
              className={`w-full text-center text-sm font-semibold py-3 rounded-xl transition-colors mb-7 block ${CTA_CLS[plan.renk]}`}
            >
              {plan.ctaMetni}
            </Link>

            {/* Özellikler */}
            <ul className="flex flex-col gap-3 flex-1">
              {plan.ozellikler.map((o) => (
                <li key={o.metin} className="flex items-start gap-2.5">
                  <Tik dahil={o.dahil} />
                  <span className={`text-sm leading-snug ${o.dahil ? "text-gray-700" : "text-gray-400"}`}>
                    {o.metin}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Karşılaştırma tablosu */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-16">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Özellik Karşılaştırması</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-6 py-3 font-semibold text-gray-600 w-1/2">Özellik</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Ücretsiz</th>
                <th className="text-center px-4 py-3 font-semibold text-blue-700 bg-blue-50">Premium</th>
                <th className="text-center px-4 py-3 font-semibold text-purple-700">Kurumsal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                ["Aktif ihale sayısı",       "1",           "Sınırsız",    "Sınırsız"],
                ["Maksimum ihale süresi",    "5 gün",       "45 gün",      "60 gün"],
                ["Süre uzatma",              "—",           "ekstra 15 güne kadar", "ekstra 30 güne kadar"],
                ["Destek uzmanı eşleştirmesi", "Standart",    "Öncelikli",   "Özel havuz"],
                ["Teklifçi analitikleri",    "—",           "✓",           "✓"],
                ["Kullanıcı sayısı",         "1",           "1",           "10"],
                ["Destek kanalı",            "E-posta",     "E-posta + Tel","Hesap yöneticisi"],
                ["API erişimi",              "—",           "—",           "✓"],
                ["SLA garantisi",            "—",           "—",           "%99,9"],
              ].map(([ozellik, ucretsiz, premium, kurumsal]) => (
                <tr key={ozellik} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3.5 text-gray-700 font-medium">{ozellik}</td>
                  <td className="px-4 py-3.5 text-center text-gray-500">{ucretsiz}</td>
                  <td className="px-4 py-3.5 text-center text-blue-700 font-semibold bg-blue-50/50">{premium}</td>
                  <td className="px-4 py-3.5 text-center text-purple-700">{kurumsal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SSS */}
      <div className="max-w-2xl mx-auto mb-16">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">Sık Sorulan Sorular</h2>
        <div className="flex flex-col gap-4">
          {[
            {
              s: "Premium'a geçince mevcut ihalelerim ne olur?",
              c: "Mevcut ihaleleriniz olduğu gibi devam eder. Yeni oluşturacağınız ihaleler ve süre uzatma işlemleri premium özelliklerinden yararlanır.",
            },
            {
              s: "İhale süresini nasıl uzatırım?",
              c: "Süresi dolmuş bir ihalenin detay sayfasında 'İhale Sonucunu Göster' raporundaki 'İhaleyi Uzat' bölümünden istediğiniz gün sayısını ekleyebilirsiniz. Premium planda ilk seçimde en fazla 45 gün, ekstra 15 güne kadar uzatarak toplamda en fazla 60 gün; Kurumsal planda ilk seçimde en fazla 60 gün, ekstra 30 güne kadar uzatarak toplamda en fazla 90 gün sürebilir.",
            },
            {
              s: "Aboneliği iptal edersem ne olur?",
              c: "Premium döneminiz sona erene kadar tüm özelliklerinizden yararlanmaya devam edersiniz. Sonrasında ücretsiz plana geçiş yapılır.",
            },
            {
              s: "Kurumsal plan için teklif nasıl alırım?",
              c: "İletişim sayfamız üzerinden bizimle iletişime geçin. İhtiyaçlarınıza özel fiyatlandırma ve özellik paketi sunulur.",
            },
          ].map((faq) => (
            <div key={faq.s} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <p className="font-semibold text-gray-900 mb-2">{faq.s}</p>
              <p className="text-sm text-gray-500 leading-relaxed">{faq.c}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Banner */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-800 rounded-2xl px-8 py-10 text-center text-white shadow-lg">
        <h2 className="text-2xl font-bold mb-2">Premium'a geçmeye hazır mısınız?</h2>
        <p className="text-blue-200 mb-6 text-sm">
          Bugün başlayın — ilk 14 gün iade güvencesi. Kredi kartı şart değil.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a href="/iletisim"
            className="bg-white text-blue-700 font-bold px-8 py-3 rounded-xl hover:bg-blue-50 transition-colors text-sm">
            Hemen Başlayın
          </a>
          <Link href="/panel"
            className="text-blue-200 hover:text-white font-medium text-sm transition-colors">
            Panele Dön →
          </Link>
        </div>
      </div>

    </div>
  );
}
