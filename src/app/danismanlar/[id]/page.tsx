import { notFound } from "next/navigation";
import Link from "next/link";
import { mockDanishmanlar, mockYorumlar } from "@/lib/mock-data";
import YorumBolumu from "./YorumBolumu";

export async function generateStaticParams() {
  return mockDanishmanlar.map((d) => ({ id: d.id }));
}

// Yıldız svg - sunucu tarafında render edilebilir
function YildizSatiri({ puan, adet }: { puan: number; adet: number }) {
  const ortalama = adet > 0 ? Math.round(puan) : 0;
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <svg key={s} className={`w-4 h-4 flex-shrink-0 ${s <= ortalama ? "text-yellow-400" : "text-gray-200"}`}
            fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
      {adet > 0 && (
        <span className="text-xs text-gray-500">
          {(puan).toFixed(1)} ({adet} yorum)
        </span>
      )}
    </div>
  );
}

export default async function DanishmanProfil({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = mockDanishmanlar.find((x) => x.id === id);
  if (!d) notFound();

  const iller = d.calistigi_iller ?? (d.il ? [d.il] : []);
  const danishmanYorumlari = mockYorumlar.filter((y) => y.danishman_id === id);
  const ortalamaHam = danishmanYorumlari.length
    ? danishmanYorumlari.reduce((s, y) => s + y.puan, 0) / danishmanYorumlari.length
    : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-8">
        <Link href="/" className="hover:text-blue-700">Ana Sayfa</Link>
        <span>/</span>
        <Link href="/danismanlar" className="hover:text-blue-700">Destek Uzmanları</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{d.ad_soyad}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* ─── Sol: Profil Kartı ─── */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sticky top-20">
            {/* Avatar + İsim */}
            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center text-3xl font-bold text-blue-700 mb-4">
                {d.ad_soyad.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>
              <h1 className="text-xl font-bold text-gray-900">{d.ad_soyad}</h1>
              <p className="text-gray-500 text-sm mt-1">Bağımsız İnşaat Destek Uzmanı</p>

              {/* Ortalama puan */}
              {danishmanYorumlari.length > 0 && (
                <div className="mt-2">
                  <YildizSatiri puan={ortalamaHam} adet={danishmanYorumlari.length} />
                </div>
              )}
            </div>

            {/* Temel Bilgiler */}
            <div className="flex flex-col gap-2.5 text-sm mb-4">
              <div className="flex items-center gap-3 text-gray-700">
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>{d.deneyim_yili} Yıl Deneyim</span>
              </div>
              <div className="flex items-start gap-3 text-gray-700">
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="leading-tight">{iller.slice(0, 3).join(", ")}{iller.length > 3 ? ` +${iller.length - 3}` : ""}</span>
              </div>
              {/* Meslek odası */}
              {d.meslek_odasi && (
                <div className="flex items-start gap-3 text-gray-700">
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span className="leading-tight text-xs">{d.meslek_odasi}</span>
                </div>
              )}
              {/* Sicil No */}
              {d.sicil_no && (
                <div className="flex items-center gap-3 text-gray-700">
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0" />
                  </svg>
                  <span className="text-xs">Sicil No: <span className="font-semibold">{d.sicil_no}</span></span>
                </div>
              )}
            </div>

            {/* İletişim */}
            <div className="border-t border-gray-100 pt-4 flex flex-col gap-3">
              <a href={`tel:${d.telefon.replace(/\s/g, "")}`}
                className="flex items-center gap-3 text-gray-700 hover:text-blue-700 transition-colors text-sm">
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {d.telefon}
              </a>
              <a href={`mailto:${d.email}`}
                className="flex items-center gap-3 text-gray-700 hover:text-blue-700 transition-colors text-sm">
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="truncate">{d.email}</span>
              </a>
            </div>

            <a href={`mailto:${d.email}`}
              className="mt-5 block w-full text-center bg-blue-700 text-white font-semibold py-3 rounded-xl hover:bg-blue-800 transition-colors text-sm">
              Görüşme Talep Et
            </a>
          </div>
        </div>

        {/* ─── Sağ: İçerik ─── */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* Hakkında */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Hakkında</h2>
            <p className="text-gray-600 leading-relaxed">{d.biyografi}</p>
          </div>

          {/* İstatistikler */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Deneyim</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-blue-700">{d.deneyim_yili}</p>
                <p className="text-blue-600 text-xs mt-1 leading-tight">Yıl Deneyim</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-green-700">{d.tamamlanan_proje_sayisi ?? "—"}</p>
                <p className="text-green-600 text-xs mt-1 leading-tight">Tamamlanan Proje</p>
              </div>
              <div className="bg-orange-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-orange-600">{d.aktif_proje_sayisi ?? "—"}</p>
                <p className="text-orange-600 text-xs mt-1 leading-tight">Aktif Proje</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-gray-700">{iller.length}</p>
                <p className="text-gray-500 text-xs mt-1 leading-tight">Hizmet Verilen İl</p>
              </div>
            </div>
          </div>

          {/* Uzmanlık Alanları */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Uzmanlık Alanları</h2>
            <div className="flex flex-wrap gap-3">
              {d.uzmanlik_alanlari.map((u) => (
                <div key={u} className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded-xl">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-semibold">{u}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Eğitim & Sertifikalar */}
          {d.diploma_sertifika && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Eğitim & Sertifikalar</h2>
              <div className="flex flex-col gap-3">
                {d.diploma_sertifika.split("·").map((s, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-700 font-medium leading-relaxed">{s.trim()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Meslek Odası & Sicil */}
          {(d.meslek_odasi || d.sicil_no) && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Mesleki Kimlik</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {d.meslek_odasi && (
                  <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Üye Olduğu Meslek Odası</p>
                      <p className="text-sm font-semibold text-gray-900">{d.meslek_odasi}</p>
                    </div>
                  </div>
                )}
                {d.sicil_no && (
                  <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0" />
                    </svg>
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Oda Sicil Numarası</p>
                      <p className="text-sm font-semibold text-gray-900 font-mono">{d.sicil_no}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Hizmet Verilen İller */}
          {iller.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Hizmet Verdiği İller</h2>
              <div className="flex flex-wrap gap-2">
                {iller.map((il) => (
                  <span key={il} className="bg-gray-100 text-gray-700 text-sm font-medium px-3 py-1.5 rounded-lg">{il}</span>
                ))}
              </div>
            </div>
          )}

          {/* Denetim Kapsamı */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Destek Kapsamı</h2>
            <div className="flex flex-col gap-3">
              {[
                { asama: "Proje / Ruhsat",        aciklama: "Mimari proje kontrolü, ruhsat başvurusu ve onay süreci takibi" },
                { asama: "Temel",                 aciklama: "Zemin etüdü kontrolü, temel kazı ve beton dökümü denetimi" },
                { asama: "Kaba İnşaat",           aciklama: "Taşıyıcı sistem, kolon, kiriş, perde duvar ve çatı denetimi" },
                { asama: "İnce İşler",            aciklama: "Elektrik, sıhhi tesisat, sıva ve kaplama kontrolleri" },
                { asama: "Yapı Denetim / Teslim", aciklama: "Final muayenesi, kusur tespiti, teslimat raporu ve iskan işlemleri" },
              ].map((a) => (
                <div key={a.asama} className="flex items-start gap-4 p-4 rounded-xl bg-gray-50">
                  <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{a.asama}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{a.aciklama}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Yorumlar — client component */}
          <YorumBolumu danishmanId={id} />

          <Link href="/danismanlar" className="flex items-center gap-2 text-gray-500 hover:text-blue-700 font-medium transition-colors text-sm">
            ← Tüm Destek Uzmanlarına Dön
          </Link>
        </div>
      </div>
    </div>
  );
}
