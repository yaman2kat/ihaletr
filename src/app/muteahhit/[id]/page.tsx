import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { mockMuteahhitler, mockReferansProjeler, mockMuteahhitYorumlar } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/server";
import YorumBolumu from "./YorumBolumu";
import type { InsaatTuru, MuteahhitProfil as MuteahhitProfilTipi, ReferansProje, MuteahhitYorum } from "@/lib/types";
import { YETKI_BELGESI_ACIKLAMA } from "@/lib/muteahhit-yetki-belgesi";

export async function generateStaticParams() {
  return mockMuteahhitler.map((m) => ({ id: m.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: dbProfil } = await supabase.from("muteahhit_profiller").select("firma_adi").eq("kullanici_id", id).maybeSingle();
  const profil = dbProfil ?? mockMuteahhitler.find((m) => m.id === id);
  if (!profil) return { title: "Müteahhit Bulunamadı - İhaleTR" };
  return { title: `${profil.firma_adi} - Müteahhit Profili | İhaleTR` };
}

const TUR_RENK: Record<InsaatTuru, string> = {
  "Kentsel Dönüşüm": "bg-purple-100 text-purple-700",
  "Kat Karşılığı":   "bg-blue-100 text-blue-700",
  "Yapı İnşaat":     "bg-green-100 text-green-700",
  "Bakım & Onarım":  "bg-orange-100 text-orange-700",
};

function YildizSatiri({ puan, adet }: { puan: number; adet: number }) {
  const yuvarlak = adet > 0 ? Math.round(puan) : 0;
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <svg key={s} className={`w-4 h-4 ${s <= yuvarlak ? "text-yellow-400" : "text-gray-200"}`}
            fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
      {adet > 0 ? (
        <span className="text-xs text-gray-500">{puan.toFixed(1)} ({adet} yorum)</span>
      ) : (
        <span className="text-xs text-gray-400">Henüz yorum yok</span>
      )}
    </div>
  );
}

export default async function MuteahhitProfil({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Once gercek veritabanindaki profili dene (kullanici_id = id); yoksa
  // demo/mock veriye dus (mockMuteahhitler "m1","m2"... gibi id'ler kullanir).
  const supabase = await createClient();
  const { data: dbProfil } = await supabase
    .from("muteahhit_profiller")
    .select("*")
    .eq("kullanici_id", id)
    .maybeSingle();

  const profil: MuteahhitProfilTipi | (typeof mockMuteahhitler)[number] | undefined =
    dbProfil ? (dbProfil as MuteahhitProfilTipi) : mockMuteahhitler.find((m) => m.id === id);
  if (!profil) notFound();

  let projeler: ReferansProje[] = mockReferansProjeler.filter((p) => p.muteahhit_id === id);
  let yorumlar: MuteahhitYorum[] = mockMuteahhitYorumlar.filter((y) => y.muteahhit_id === id);
  if (dbProfil) {
    const [{ data: dbProjeler }, { data: dbYorumlar }] = await Promise.all([
      supabase.from("muteahhit_referans_projeler").select("*").eq("muteahhit_id", id).order("yil", { ascending: false }),
      supabase.from("muteahhit_yorumlar").select("*").eq("muteahhit_id", id),
    ]);
    projeler = (dbProjeler ?? []) as ReferansProje[];
    yorumlar = (dbYorumlar ?? []) as MuteahhitYorum[];
  }
  const ortalamaHam = yorumlar.length
    ? yorumlar.reduce((s, y) => s + y.puan, 0) / yorumlar.length
    : 0;

  const sertifikalar = profil.sertifika_bilgisi
    ? profil.sertifika_bilgisi.split("·").map((s) => s.trim()).filter(Boolean)
    : [];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-8">
        <Link href="/" className="hover:text-blue-700">Ana Sayfa</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{profil.firma_adi}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* ─── Sol: Profil Kartı ─── */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sticky top-20 flex flex-col gap-5">

            {/* Avatar + Firma */}
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center mb-4 shadow-md">
                {profil.foto_url ? (
                  <img src={profil.foto_url} alt={profil.firma_adi}
                    className="w-20 h-20 rounded-2xl object-cover" />
                ) : (
                  <span className="text-3xl font-bold text-white">
                    {profil.firma_adi.charAt(0)}
                  </span>
                )}
              </div>
              <h1 className="text-lg font-bold text-gray-900 leading-snug mb-1">
                {profil.firma_adi}
              </h1>
              {profil.kurulus_yili && (
                <p className="text-sm text-gray-500">Kuruluş: {profil.kurulus_yili}</p>
              )}
              <div className="mt-2">
                <YildizSatiri puan={ortalamaHam} adet={yorumlar.length} />
              </div>
            </div>

            {/* İstatistikler */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-blue-50 rounded-xl p-3">
                <p className="text-xl font-bold text-blue-700">{profil.tamamlanan_proje_sayisi}</p>
                <p className="text-xs text-gray-500 leading-tight">Tamamlanan Proje</p>
              </div>
              <div className="bg-green-50 rounded-xl p-3">
                <p className="text-xl font-bold text-green-700">{profil.kazanilan_ihale_sayisi}</p>
                <p className="text-xs text-gray-500 leading-tight">Kazanılan İhale</p>
              </div>
              <div className="bg-orange-50 rounded-xl p-3">
                <p className="text-xl font-bold text-orange-600">{profil.aktif_ihale_sayisi}</p>
                <p className="text-xs text-gray-500 leading-tight">Aktif İhale</p>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4 flex flex-col gap-3 text-sm">
              {/* Lisans / Sicil */}
              {profil.lisans_no && (
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                  <div>
                    <p className="text-xs text-gray-400">Yeterlik Belgesi No</p>
                    <p className="font-medium text-gray-900">{profil.lisans_no}</p>
                  </div>
                </div>
              )}
              {profil.yetki_belgesi_grubu && (
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-xs text-gray-400">Yetki Belgesi Grubu</p>
                    <p
                      className="font-medium text-gray-900 cursor-help underline decoration-dotted decoration-gray-300 underline-offset-2"
                      title={YETKI_BELGESI_ACIKLAMA[profil.yetki_belgesi_grubu] || undefined}
                    >
                      {profil.yetki_belgesi_grubu}
                    </p>
                  </div>
                </div>
              )}
              {profil.sicil_no && (
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                  </svg>
                  <div>
                    <p className="text-xs text-gray-400">Sicil No</p>
                    <p className="font-medium text-gray-900">{profil.sicil_no}</p>
                  </div>
                </div>
              )}
              {/* Telefon */}
              {profil.telefon && (
                <a href={`tel:${profil.telefon.replace(/\s/g, "")}`}
                  className="flex items-center gap-2 text-gray-700 hover:text-blue-700 transition-colors">
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span className="font-medium">{profil.telefon}</span>
                </a>
              )}
              {/* E-posta */}
              {profil.email && (
                <a href={`mailto:${profil.email}`}
                  className="flex items-center gap-2 text-gray-700 hover:text-blue-700 transition-colors">
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span className="font-medium truncate">{profil.email}</span>
                </a>
              )}
            </div>

            {/* Profil Düzenle */}
            <Link
              href={`/muteahhit/${id}/duzenle`}
              className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-700 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Profili Düzenle
            </Link>
          </div>
        </div>

        {/* ─── Sağ: Ana İçerik ─── */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* Hakkında */}
          {profil.aciklama && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-3">Firma Hakkında</h2>
              <p className="text-gray-600 leading-relaxed text-sm">{profil.aciklama}</p>
            </div>
          )}

          {/* Uzmanlık + İller */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Uzmanlık & Faaliyet Alanları</h2>
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Uzmanlık</p>
              <div className="flex flex-wrap gap-2">
                {profil.uzmanlik_alanlari.map((u) => (
                  <span key={u} className={`text-xs font-semibold px-3 py-1 rounded-full ${TUR_RENK[u]}`}>
                    {u}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Çalıştığı İller</p>
              <div className="flex flex-wrap gap-2">
                {profil.calistigi_iller.map((il) => (
                  <span key={il} className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-full">
                    {il}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Sertifikalar */}
          {sertifikalar.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Belgeler & Sertifikalar</h2>
              <ul className="flex flex-col gap-2">
                {sertifikalar.map((sert, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {sert}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Referans Projeler */}
          {projeler.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold text-gray-900">Referans Projeler</h2>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                  {projeler.length} proje
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {projeler.map((proje) => (
                  <div key={proje.id}
                    className="border border-gray-100 rounded-xl p-4 hover:border-blue-200 hover:bg-blue-50/30 transition-colors">
                    {proje.fotograf_url ? (
                      <img src={proje.fotograf_url} alt={proje.proje_adi}
                        className="w-full h-36 object-cover rounded-lg mb-3" />
                    ) : (
                      <div className="w-full h-28 bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-gray-900 leading-snug">{proje.proje_adi}</h3>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${TUR_RENK[proje.tur]}`}>
                        {proje.tur}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {proje.konum}
                      </span>
                      <span>{proje.yil}</span>
                    </div>
                    {proje.aciklama && (
                      <p className="text-xs text-gray-500 leading-relaxed">{proje.aciklama}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Yorumlar */}
          <YorumBolumu muteahhitId={id} />

        </div>
      </div>
    </div>
  );
}
