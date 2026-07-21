import Link from "next/link";
import IhaleKarti from "@/components/IhaleKarti";
import CtaSection from "@/components/CtaSection";
import { mockIhaleler } from "@/lib/mock-data";

const kategoriler = [
  { ad: "Kentsel Dönüşüm", ikon: "🏙️", renk: "bg-orange-50 border-orange-200 text-orange-700" },
  { ad: "Kat Karşılığı",   ikon: "🏢", renk: "bg-blue-50 border-blue-200 text-blue-700"       },
  { ad: "Yapı İnşaat",     ikon: "🏗️", renk: "bg-yellow-50 border-yellow-200 text-yellow-700" },
  { ad: "Bakım & Onarım",  ikon: "🔧", renk: "bg-green-50 border-green-200 text-green-700"    },
];

const istatistikler = [
  { sayi: "1.240+", etiket: "Aktif İhale" },
  { sayi: "8.500+", etiket: "Kayıtlı Firma" },
  { sayi: "₺2.4 Milyar", etiket: "Toplam İşlem Hacmi" },
  { sayi: "81", etiket: "İl Kapsamı" },
];

export default function AnaSayfa() {
  const aktifIhaleler = mockIhaleler.filter((i) => i.durum === "aktif").slice(0, 3);

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-700 to-blue-900 text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-6">
            Türkiye&apos;nin Dijital
            <br />
            <span className="text-blue-200">İnşaat İhale Platformu</span>
          </h1>
          <p className="text-lg text-blue-100 mb-10 max-w-2xl mx-auto">
            Kamu ve özel sektör inşaat ihalelerini tek platformda takip edin. Bağımsız danışman desteğiyle güvenli, şeffaf ihale süreci.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/ihaleler"
              className="bg-white text-blue-700 font-semibold px-8 py-3.5 rounded-xl hover:bg-blue-50 transition-colors text-lg"
            >
              İhalelere Göz At
            </Link>
            <Link
              href="/ihale-olustur"
              className="border-2 border-white text-white font-semibold px-8 py-3.5 rounded-xl hover:bg-white/10 transition-colors text-lg"
            >
              İhale Oluştur
            </Link>
            <Link
              href="/danismanlar"
              className="border-2 border-blue-300 text-blue-100 font-semibold px-8 py-3.5 rounded-xl hover:bg-white/10 hover:border-white hover:text-white transition-colors text-lg"
            >
              Danışmanla Konuş
            </Link>
          </div>
        </div>
      </section>

      {/* İstatistikler */}
      <section className="bg-white border-b border-gray-100 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {istatistikler.map((ist) => (
              <div key={ist.etiket}>
                <p className="text-3xl font-bold text-blue-700">{ist.sayi}</p>
                <p className="text-gray-500 mt-1 text-sm">{ist.etiket}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Kategoriler */}
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Kategoriler</h2>
          <p className="text-gray-500 text-center mb-10">İlgilendiğiniz kategoriye göre ihaleleri filtreleyin</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {kategoriler.map((kat) => (
              <Link
                key={kat.ad}
                href={`/ihaleler?kategori=${encodeURIComponent(kat.ad)}`}
                className={`flex flex-col items-center gap-3 p-6 rounded-xl border-2 ${kat.renk} hover:scale-105 transition-transform text-center`}
              >
                <span className="text-4xl">{kat.ikon}</span>
                <span className="text-sm font-semibold leading-tight">{kat.ad}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Bağımsız Danışman Banner */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
              <div className="p-8 md:p-10 flex flex-col justify-center">
                <span className="inline-block text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full mb-4 w-fit">
                  YENİ ÖZELLİK
                </span>
                <h2 className="text-2xl font-bold text-gray-900 mb-3 leading-snug">
                  Bağımsız İnşaat Danışmanı ile Güvenle İnşa Edin
                </h2>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  Uzman ve tarafsız danışmanlar, inşaatınızı başından sonuna denetler.
                  Proje aşamasından teslimat kontrolüne kadar her adımda yanınızda.
                </p>
                <div className="flex flex-col gap-2 mb-8">
                  {["Proje ve ruhsat denetimi", "Temel, kaba ve ince iş kontrolleri", "Tarafsız teslimat raporu"].map((m) => (
                    <div key={m} className="flex items-center gap-2 text-sm text-gray-700">
                      <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      {m}
                    </div>
                  ))}
                </div>
                <Link
                  href="/danismanlar"
                  className="bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl hover:bg-blue-800 transition-colors w-fit"
                >
                  Danışman Bul →
                </Link>
              </div>
              <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-8 md:p-10 flex flex-col justify-center text-white">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { sayi: "120+", etiket: "Aktif Danışman" },
                    { sayi: "3.500+", etiket: "Denetlenen Proje" },
                    { sayi: "81", etiket: "İl Kapsamı" },
                    { sayi: "%98", etiket: "Müşteri Memnuniyeti" },
                  ].map((s) => (
                    <div key={s.etiket} className="bg-white/10 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold">{s.sayi}</p>
                      <p className="text-blue-200 text-xs mt-1">{s.etiket}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Öne Çıkan İhaleler */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Öne Çıkan İhaleler</h2>
              <p className="text-gray-500">Son eklenen aktif ihaleler</p>
            </div>
            <Link
              href="/ihaleler"
              className="text-blue-700 font-medium hover:underline hidden sm:block"
            >
              Tümünü Gör →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {aktifIhaleler.map((ihale) => (
              <IhaleKarti key={ihale.id} ihale={ihale} />
            ))}
          </div>
          <div className="text-center mt-8 sm:hidden">
            <Link href="/ihaleler" className="text-blue-700 font-medium hover:underline">
              Tüm İhaleleri Gör →
            </Link>
          </div>
        </div>
      </section>

      <CtaSection />
    </div>
  );
}
