import Link from "next/link";
import { Ihale } from "@/lib/types";
import { mockIhaleTeklifleri } from "@/lib/mock-data";
import EnDusukTeklif from "@/components/EnDusukTeklif";

// Durum rozeti mantığı:
// - Beklemede/İptal: sabit rozet.
// - Süresi henüz dolmamış aktif ihale: geri sayım (3 günden az turuncu, aksi yeşil).
// - Süresi dolmuş (aktif+gecmis ya da durum=tamamlandi) AMA kazanan
//   secilmemis: "Karar Bekleniyor" (turuncu) -- otomatik sonlandirma
//   kazanan atamadan da durumu tamamlandi yapabildigi icin bu ayrim
//   sadece durum alanina degil secilen_firma_id'ye bakar.
// - Süresi dolmus VE kazanan secilmis: "Tamamlandı" (gri).
function rozetHesapla(ihale: Ihale, kalanGun: number): { etiket: string; cls: string } {
  if (ihale.durum === "beklemede") return { etiket: "Beklemede", cls: "bg-yellow-100 text-yellow-800" };
  if (ihale.durum === "iptal") return { etiket: "İptal", cls: "bg-red-100 text-red-800" };

  const suresiDolmusMu = ihale.durum === "tamamlandi" || (ihale.durum === "aktif" && kalanGun <= 0);
  if (!suresiDolmusMu) {
    if (kalanGun < 3) return { etiket: `${kalanGun} gün kaldı`, cls: "bg-amber-100 text-amber-700" };
    return { etiket: `${kalanGun} gün kaldı`, cls: "bg-green-100 text-green-800" };
  }
  if (ihale.secilen_firma_id) return { etiket: "Tamamlandı", cls: "bg-gray-100 text-gray-700" };
  return { etiket: "Karar Bekleniyor", cls: "bg-amber-100 text-amber-700" };
}

function formatPara(tutar: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 0,
  }).format(tutar);
}

function formatTarih(tarih: string): string {
  return new Date(tarih).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

interface Props {
  ihale: Ihale;
  /** Verilirse hesaplanan durum rozetinin yerine gecer (ör. sahibine
   * ozel "Beklemede - Sadece siz görebilirsiniz" rozeti). */
  ozelRozet?: { etiket: string; cls: string };
}

export default function IhaleKarti({ ihale, ozelRozet }: Props) {
  const kalanGun = Math.ceil(
    (new Date(ihale.bitis_tarihi).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  const bittiMi = ihale.durum === "tamamlandi" || (ihale.durum === "aktif" && kalanGun <= 0);
  const teklifler = mockIhaleTeklifleri[ihale.id] ?? [];
  const rozet = ozelRozet ?? rozetHesapla(ihale, kalanGun);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-6 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${rozet.cls}`}
        >
          {rozet.etiket}
        </span>
        <span className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-full">
          {ihale.kategori}
        </span>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 leading-snug mb-1">
          {ihale.baslik}
        </h3>
        <p className="text-sm text-gray-500">{ihale.kurum}</p>
        <p className="text-sm text-gray-400">{ihale.sehir}</p>
      </div>

      <p className="text-sm text-gray-600 line-clamp-2">{ihale.aciklama}</p>

      {(ihale.yapi_insaat_ruhsati || ihale.proje) && (
        <div className="flex flex-wrap gap-2">
          {ihale.yapi_insaat_ruhsati && (
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              ihale.yapi_insaat_ruhsati === "var"
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-500"
            }`}>
              Ruhsat: {ihale.yapi_insaat_ruhsati === "var" ? "Var" : "Yok"}
            </span>
          )}
          {ihale.proje && (
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              ihale.proje === "var"
                ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-500"
            }`}>
              Proje: {ihale.proje === "var" ? "Var" : "Yok"}
            </span>
          )}
        </div>
      )}

      <div className="border-t border-gray-100 pt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-gray-400 text-xs mb-0.5">Başlangıç Fiyatı</p>
          <p className="font-semibold text-gray-900">{formatPara(ihale.baslangic_fiyati)}</p>
        </div>
        {bittiMi && (
          <EnDusukTeklif
            ihaleId={ihale.id}
            mevcutTeklif={ihale.mevcut_teklif}
            olusturanId={ihale.olusturan_id}
            teklifler={teklifler}
            bittiMi={bittiMi}
          />
        )}
        <div>
          <p className="text-gray-400 text-xs mb-0.5">Bitiş Tarihi</p>
          <p className="text-gray-700">{formatTarih(ihale.bitis_tarihi)}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs mb-0.5">Kalan Süre</p>
          <p className={kalanGun > 0 ? "text-orange-600 font-medium" : "text-gray-400"}>
            {kalanGun > 0 ? `${kalanGun} gün` : "Sona erdi"}
          </p>
        </div>
      </div>

      <Link
        href={`/ihaleler/${ihale.id}`}
        className="block w-full text-center bg-blue-700 text-white font-medium py-2.5 rounded-lg hover:bg-blue-800 transition-colors mt-auto"
      >
        Detayları Gör
      </Link>
    </div>
  );
}
