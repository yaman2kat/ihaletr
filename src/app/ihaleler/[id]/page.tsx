import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { mockIhaleler, mockIhaleTeklifleri, type MockTeklif } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/server";
import type { Ihale } from "@/lib/types";
import GeriSayim from "./GeriSayim";
import SonTeklifler from "./SonTeklifler";
import TeklifKutusu from "./TeklifKutusu";
import IhaleBelgeleri from "./IhaleBelgeleri";
import AdaParselButon from "@/components/AdaParselButon";
import EnDusukTeklif from "@/components/EnDusukTeklif";
import IhaleSonucRaporu from "./IhaleSonucRaporu";

function formatPara(tutar: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency", currency: "TRY", minimumFractionDigits: 0,
  }).format(tutar);
}

function formatTarih(tarih: string): string {
  return new Date(tarih).toLocaleDateString("tr-TR", {
    day: "numeric", month: "long", year: "numeric",
  });
}

const durumRenk: Record<string, string> = {
  aktif:      "bg-green-100 text-green-800",
  beklemede:  "bg-yellow-100 text-yellow-800",
  tamamlandi: "bg-gray-100 text-gray-700",
  iptal:      "bg-red-100 text-red-800",
};

const durumEtiket: Record<string, string> = {
  aktif:      "Aktif",
  beklemede:  "Beklemede",
  tamamlandi: "Tamamlandı",
  iptal:      "İptal",
};

export async function generateStaticParams() {
  return mockIhaleler.map((ihale) => ({ id: ihale.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: dbIhale } = await supabase.from("ihaleler").select("baslik, sehir, ilce").eq("id", id).maybeSingle();
  const ihale = dbIhale ?? mockIhaleler.find((i) => i.id === id);
  if (!ihale) return { title: "İhale Bulunamadı - İhaleTR" };
  const konum = "ilce" in ihale && ihale.ilce ? `${ihale.sehir} / ${ihale.ilce}` : ihale.sehir;
  return { title: `${ihale.baslik} - ${konum} | İhaleTR` };
}

export default async function IhaleDetay({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Once gercek veritabanindaki ihaleyi dene; bulunamazsa demo/mock
  // veriye dus (mockIhaleler sabit "1","2"... gibi id'ler kullanir).
  const supabase = await createClient();
  const { data: dbIhale } = await supabase.from("ihaleler").select("*").eq("id", id).maybeSingle();

  const ihale: Ihale | undefined = dbIhale ? (dbIhale as Ihale) : mockIhaleler.find((i) => i.id === id);
  if (!ihale) notFound();

  // "Belge Durumu" kartındaki "Proje: Var" rozetini doğrudan dosyaya
  // bağlamak için — herkese açık (RLS: tur='proje' tapu gibi hassas
  // türlerden değil) bina projesi belgesi.
  let projeBelgeUrl: string | null = null;
  if (dbIhale && ihale.proje === "var") {
    const { data: projeBelge } = await supabase
      .from("belgeler")
      .select("dosya_url")
      .eq("ihale_id", id)
      .eq("tur", "proje")
      .limit(1)
      .maybeSingle();
    projeBelgeUrl = projeBelge?.dosya_url ?? null;
  }

  const kalanGun = Math.ceil(
    (new Date(ihale.bitis_tarihi).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  const aktifVeDevam = ihale.durum === "aktif" && kalanGun > 0;
  // Süresi dolmuş ya da tamamlanmış ihaleler için sonuç raporu gösterilir.
  const sonucGosterilsinMi = ihale.durum === "tamamlandi" || (ihale.durum === "aktif" && kalanGun <= 0);

  // Mock/demo ihaleler icin sabit ornek teklif listesi (gercek ihalelerde
  // teklif veren kimligi/tutari kimseye gosterilmez -- bkz. SonTeklifler,
  // EnDusukTeklif, IhaleSonucRaporu). Gercek ihalelerde teklif SAYISI ise
  // RLS'i bilincli atlayan, kimlik/tutar icermeyen herkese acik bir RPC
  // ile alinir.
  const teklifler: MockTeklif[] = mockIhaleTeklifleri[id] ?? [];
  let teklifSayisi = teklifler.length;

  if (dbIhale) {
    const { data: sayi } = await supabase.rpc("ihale_teklif_sayisi", { p_ihale_id: id });
    teklifSayisi = sayi ?? 0;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-blue-700">Ana Sayfa</Link>
        <span>/</span>
        <Link href="/ihaleler" className="hover:text-blue-700">İhaleler</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium truncate max-w-xs">{ihale.baslik}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* ─── Sol: Ana İçerik ─────────────────────────────── */}
        <div className="lg:col-span-2 flex flex-col gap-5">

          {/* Başlık Kartı */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className={`text-sm font-semibold px-3 py-1 rounded-full ${durumRenk[ihale.durum]}`}>
                {durumEtiket[ihale.durum]}
              </span>
              <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                {ihale.kategori}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 leading-snug">
              {ihale.baslik}
            </h1>

            {/* Meta bilgiler */}
            <div className="flex flex-wrap gap-4 text-sm text-gray-600 pb-4 border-b border-gray-100 mb-4">
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                {ihale.kurum}
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {ihale.sehir}{ihale.ilce ? ` / ${ihale.ilce}` : ""}
              </span>
            </div>

            {/* İstatistikler */}
            <div className="flex flex-wrap gap-5 text-sm">
              <div className="flex items-center gap-1.5 text-gray-500">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span><strong className="text-gray-800">{ihale.goruntulenme_sayisi ?? 0}</strong> görüntülenme</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-500">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span><strong className="text-gray-800">{teklifSayisi}</strong> teklif</span>
              </div>
            </div>
          </div>

          {/* Açıklama */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-3">İhale Açıklaması</h2>
            <p className="text-gray-600 leading-relaxed">{ihale.aciklama}</p>
          </div>

          {/* Tarih Bilgileri */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Tarih Bilgileri</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-400 mb-1">İlan Tarihi</p>
                <p className="font-semibold text-gray-900">{formatTarih(ihale.baslangic_tarihi)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-400 mb-1">Son Teklif Tarihi</p>
                <p className="font-semibold text-gray-900">{formatTarih(ihale.bitis_tarihi)}</p>
              </div>
            </div>
          </div>

          {/* Belge Durumu */}
          {(ihale.yapi_insaat_ruhsati || ihale.proje) && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Belge Durumu</h2>
              <div className="grid grid-cols-2 gap-4">
                {ihale.yapi_insaat_ruhsati && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-400 mb-1">Yapı İnşaat Ruhsatı</p>
                    <p className={`font-semibold text-sm ${
                      ihale.yapi_insaat_ruhsati === "var" ? "text-green-700" : "text-red-600"
                    }`}>
                      {ihale.yapi_insaat_ruhsati === "var" ? "✓ Var" : "✗ Yok"}
                    </p>
                  </div>
                )}
                {ihale.proje && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-400 mb-1">Proje</p>
                    {projeBelgeUrl ? (
                      <a
                        href={projeBelgeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-sm text-green-700 hover:underline inline-flex items-center gap-1"
                      >
                        ✓ Var — Dosyayı Görüntüle
                      </a>
                    ) : (
                      <p className={`font-semibold text-sm ${
                        ihale.proje === "var" ? "text-green-700" : "text-red-600"
                      }`}>
                        {ihale.proje === "var" ? "✓ Var" : "✗ Yok"}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Taşınmaz Bilgileri + Ada-Parsel butonu */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              Taşınmaz Bilgileri
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">İl</p>
                <p className="font-semibold text-gray-900 text-sm">{ihale.sehir}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">İlçe</p>
                <p className="font-semibold text-gray-900 text-sm">{ihale.ilce ?? "—"}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Mahalle</p>
                <p className="font-semibold text-gray-900 text-sm">{ihale.mahalle ?? "—"}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Cadde/Sokak</p>
                <p className="font-semibold text-gray-900 text-sm">{ihale.cadde_sokak ?? "—"}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Ada No</p>
                <p className="font-semibold text-gray-900 text-sm">{ihale.ada_no ?? "—"}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Parsel No</p>
                <p className="font-semibold text-gray-900 text-sm">{ihale.parsel_no ?? "—"}</p>
              </div>
            </div>
            <AdaParselButon
              sehir={ihale.sehir}
              ilce={ihale.ilce}
              adaNo={ihale.ada_no}
              parselNo={ihale.parsel_no}
            />
          </div>

          {/* Belgeler */}
          <IhaleBelgeleri ihaleId={ihale.id} />

          {/* Son Teklifler */}
          <SonTeklifler
            ihaleId={ihale.id}
            teklifler={teklifler}
            toplamSayi={teklifSayisi}
          />

        </div>

        {/* ─── Sağ: Yan Panel ──────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <div className="sticky top-20 flex flex-col gap-4">

            {/* Geri Sayım */}
            {aktifVeDevam && (
              <GeriSayim bitisTarihi={ihale.bitis_tarihi} />
            )}

            {/* Fiyat Bilgisi */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Fiyat Bilgisi
              </p>
              <div className="flex flex-col gap-3 mb-5">
                <EnDusukTeklif
                  ihaleId={ihale.id}
                  mevcutTeklif={ihale.mevcut_teklif}
                  olusturanId={ihale.olusturan_id}
                  teklifler={teklifler}
                  bittiMi={sonucGosterilsinMi}
                  boyut="buyuk"
                />
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-400 mb-1">Başlangıç Fiyatı</p>
                  <p className="text-xl font-semibold text-gray-700">{formatPara(ihale.baslangic_fiyati)}</p>
                </div>
              </div>

              {/* Teklif Ver */}
              <TeklifKutusu
                ihaleId={ihale.id}
                baslangicFiyati={ihale.baslangic_fiyati}
                durum={ihale.durum}
                kalanGun={kalanGun}
              />
            </div>

            {/* İhale Sonucu (süresi dolmuş/tamamlanmış ihaleler) */}
            {sonucGosterilsinMi && (
              <IhaleSonucRaporu
                ihale={{
                  id: ihale.id,
                  baslik: ihale.baslik,
                  kurum: ihale.kurum,
                  baslangic_tarihi: ihale.baslangic_tarihi,
                  bitis_tarihi: ihale.bitis_tarihi,
                }}
                teklifler={teklifler}
                olusturanId={ihale.olusturan_id}
              />
            )}

            {/* Ada-Parsel (sidebar) */}
            <AdaParselButon
              sehir={ihale.sehir}
              ilce={ihale.ilce}
              adaNo={ihale.ada_no}
              parselNo={ihale.parsel_no}
            />

            <Link
              href="/ihaleler"
              className="flex items-center justify-center gap-2 text-gray-500 hover:text-blue-700 text-sm font-medium py-2 transition-colors"
            >
              ← Tüm İhalelere Dön
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
