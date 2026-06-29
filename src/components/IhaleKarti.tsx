import Link from "next/link";
import { Ihale } from "@/lib/types";

const durumRenk: Record<string, string> = {
  aktif: "bg-green-100 text-green-800",
  beklemede: "bg-yellow-100 text-yellow-800",
  tamamlandi: "bg-gray-100 text-gray-700",
  iptal: "bg-red-100 text-red-800",
};

const durumEtiket: Record<string, string> = {
  aktif: "Aktif",
  beklemede: "Beklemede",
  tamamlandi: "Tamamlandı",
  iptal: "İptal",
};

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

export default function IhaleKarti({ ihale }: { ihale: Ihale }) {
  const kalanGun = Math.ceil(
    (new Date(ihale.bitis_tarihi).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-6 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${durumRenk[ihale.durum]}`}
        >
          {durumEtiket[ihale.durum]}
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

      <div className="border-t border-gray-100 pt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-gray-400 text-xs mb-0.5">Başlangıç Fiyatı</p>
          <p className="font-semibold text-gray-900">{formatPara(ihale.baslangic_fiyati)}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs mb-0.5">Güncel Teklif</p>
          <p className="font-semibold text-blue-700">
            {ihale.mevcut_teklif ? formatPara(ihale.mevcut_teklif) : "Henüz yok"}
          </p>
        </div>
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
