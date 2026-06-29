import Link from "next/link";

interface Paket {
  isim: string;
  hak: string;
  hakSayi: number | null;
  fiyat: string;
  fiyatAlt: string;
  aciklama: string;
  ozellikler: string[];
  popüler: boolean;
  ctaMetni: string;
  ctaHref: string;
  vurgu: "gray" | "blue" | "purple";
}

const PAKETLER: Paket[] = [
  {
    isim: "Başlangıç",
    hak: "5 teklif hakkı",
    hakSayi: 5,
    fiyat: "299₺",
    fiyatAlt: "tek seferlik",
    aciklama: "Birkaç ihaleyie teklif vermek isteyen bireysel kullanıcılar için.",
    ozellikler: [
      "5 teklif hakkı (tek seferlik)",
      "Haklar süresiz geçerlidir",
      "Tüm ihaleler için geçerli",
      "Teklif takip paneli",
    ],
    popüler: false,
    ctaMetni: "Paketi Satın Al",
    ctaHref: "/odeme/baslangic",
    vurgu: "gray",
  },
  {
    isim: "Standart",
    hak: "15 teklif hakkı",
    hakSayi: 15,
    fiyat: "699₺",
    fiyatAlt: "tek seferlik",
    aciklama: "Düzenli teklif verenler ve KOBİ'ler için en verimli paket.",
    ozellikler: [
      "15 teklif hakkı (tek seferlik)",
      "Haklar süresiz geçerlidir",
      "Tüm ihaleler için geçerli",
      "Teklif takip paneli",
      "Öncelikli bildirimler",
    ],
    popüler: true,
    ctaMetni: "Paketi Satın Al",
    ctaHref: "/odeme/standart",
    vurgu: "blue",
  },
  {
    isim: "Pro",
    hak: "Sınırsız teklif",
    hakSayi: null,
    fiyat: "1.499₺",
    fiyatAlt: "/ ay",
    aciklama: "Aktif müteahhitler ve kurumsal firmalar için limitsiz teklif imkânı.",
    ozellikler: [
      "Sınırsız teklif hakkı",
      "Aylık otomatik yenileme",
      "Tüm ihaleler için geçerli",
      "Teklif analitikleri",
      "Öncelikli bildirimler",
      "Öncelikli müşteri desteği",
    ],
    popüler: false,
    ctaMetni: "Pro'ya Geç",
    ctaHref: "/odeme/pro",
    vurgu: "purple",
  },
];

const KART_CLS: Record<string, string> = {
  gray:   "border-gray-200 bg-white",
  blue:   "border-blue-500 bg-white ring-2 ring-blue-500 ring-offset-2",
  purple: "border-purple-200 bg-white",
};

const CTA_CLS: Record<string, string> = {
  gray:   "bg-gray-900 text-white hover:bg-gray-700",
  blue:   "bg-blue-700 text-white hover:bg-blue-800 shadow-md shadow-blue-200",
  purple: "bg-purple-700 text-white hover:bg-purple-800 shadow-md shadow-purple-200",
};

const HAK_CLS: Record<string, string> = {
  gray:   "bg-gray-50 text-gray-700 border-gray-200",
  blue:   "bg-blue-50 text-blue-700 border-blue-100",
  purple: "bg-purple-50 text-purple-700 border-purple-100",
};

export default function TeklifPaketiSayfasi() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

      {/* Başlık */}
      <div className="text-center mb-14">
        <span className="inline-block text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full mb-4 tracking-wide uppercase">
          Teklif Paketleri
        </span>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Teklif Hakkınızı Genişletin</h1>
        <p className="text-gray-500 text-lg max-w-xl mx-auto leading-relaxed">
          Her kullanıcıya ücretsiz 2 teklif hakkı tanınır.
          Daha fazlası için aşağıdaki paketlerden birini seçin.
        </p>

        {/* Mevcut hak göstergesi */}
        <div className="inline-flex items-center gap-2 mt-6 bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium px-5 py-2.5 rounded-full">
          <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Teklif hakkınız doldu. Teklif vermek için bir paket seçin.
        </div>
      </div>

      {/* Paket Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
        {PAKETLER.map((paket) => (
          <div key={paket.isim}
            className={`relative rounded-2xl border p-8 flex flex-col ${KART_CLS[paket.vurgu]}`}>
            {paket.popüler && (
              <div className="absolute -top-3.5 left-0 right-0 flex justify-center">
                <span className="bg-blue-700 text-white text-xs font-bold px-4 py-1 rounded-full shadow">
                  En Popüler
                </span>
              </div>
            )}

            {/* Hak sayısı rozeti */}
            <div className={`inline-flex items-center gap-1.5 self-start text-xs font-bold px-3 py-1.5 rounded-full border mb-5 ${HAK_CLS[paket.vurgu]}`}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {paket.hak}
            </div>

            <div className="mb-6">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{paket.isim}</p>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-bold text-gray-900">{paket.fiyat}</span>
                <span className="text-gray-400 text-sm">{paket.fiyatAlt}</span>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">{paket.aciklama}</p>
            </div>

            <Link href={paket.ctaHref}
              className={`w-full text-center text-sm font-semibold py-3 rounded-xl transition-colors mb-7 block ${CTA_CLS[paket.vurgu]}`}>
              {paket.ctaMetni}
            </Link>

            <ul className="flex flex-col gap-3 flex-1">
              {paket.ozellikler.map((o) => (
                <li key={o} className="flex items-start gap-2.5">
                  <svg className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-gray-700 leading-snug">{o}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Karşılaştırma */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-16">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Paket Karşılaştırması</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-6 py-3 font-semibold text-gray-600 w-2/5">Özellik</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Ücretsiz</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Başlangıç</th>
                <th className="text-center px-4 py-3 font-semibold text-blue-700 bg-blue-50">Standart</th>
                <th className="text-center px-4 py-3 font-semibold text-purple-700">Pro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                ["Teklif hakkı",          "2",        "5",       "15",          "Sınırsız"],
                ["Geçerlilik",            "Tek sef.", "Süresiz", "Süresiz",     "Aylık yenileme"],
                ["Teklif takip paneli",   "✓",        "✓",       "✓",           "✓"],
                ["Öncelikli bildirimler", "—",        "—",       "✓",           "✓"],
                ["Teklif analitikleri",   "—",        "—",       "—",           "✓"],
                ["Destek kanalı",         "E-posta",  "E-posta", "E-posta",     "Öncelikli"],
              ].map(([ozellik, ucretsiz, baslangic, standart, pro]) => (
                <tr key={ozellik} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3.5 text-gray-700 font-medium">{ozellik}</td>
                  <td className="px-4 py-3.5 text-center text-gray-400">{ucretsiz}</td>
                  <td className="px-4 py-3.5 text-center text-gray-600">{baslangic}</td>
                  <td className="px-4 py-3.5 text-center text-blue-700 font-semibold bg-blue-50/50">{standart}</td>
                  <td className="px-4 py-3.5 text-center text-purple-700">{pro}</td>
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
              s: "Ücretsiz 2 teklif hakkı nasıl kullanılır?",
              c: "Hesap oluştururken otomatik olarak 2 ücretsiz teklif hakkı tanınır. Bu haklar herhangi bir ihaleyie teklif verdiğinizde otomatik düşer.",
            },
            {
              s: "Başlangıç veya Standart paketlerdeki haklar ne zaman sona erer?",
              c: "Bu paketlerdeki haklar süresizdir. Satın aldığınız an aktive edilir ve siz kullanana kadar hesabınızda kalır.",
            },
            {
              s: "Pro paket aylık mı ücretlendirilir?",
              c: "Evet, Pro paket aylık abonelik modeliyle çalışır. İptal ederseniz dönem sonuna kadar sınırsız teklif hakkınız devam eder.",
            },
            {
              s: "Birden fazla paket satın alabilir miyim?",
              c: "Evet, Başlangıç ve Standart paketleri dilediğiniz kadar satın alabilirsiniz. Haklar toplanarak hesabınıza eklenir.",
            },
          ].map((faq) => (
            <div key={faq.s} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <p className="font-semibold text-gray-900 mb-2">{faq.s}</p>
              <p className="text-sm text-gray-500 leading-relaxed">{faq.c}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Alt bağlantılar */}
      <div className="flex items-center justify-center gap-5 text-sm">
        <Link href="/panel" className="text-gray-500 hover:text-blue-700 font-medium transition-colors">
          ← Panele Dön
        </Link>
        <span className="text-gray-200">|</span>
        <Link href="/ihaleler" className="text-gray-500 hover:text-blue-700 font-medium transition-colors">
          İhalelere Gözat
        </Link>
        <span className="text-gray-200">|</span>
        <Link href="/iletisim" className="text-gray-500 hover:text-blue-700 font-medium transition-colors">
          Destek Al
        </Link>
      </div>
    </div>
  );
}
