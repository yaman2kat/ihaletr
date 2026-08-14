"use client";

import Link from "next/link";
import { useTeklifRaporuErisimi } from "@/hooks/useTeklifRaporuErisimi";
import { useGercekTeklifErisimi } from "@/hooks/useGercekTeklifErisimi";
import { gercekIhaleIdMi } from "@/lib/ihale-sonuc";

function formatPara(tutar: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency", currency: "TRY", minimumFractionDigits: 0,
  }).format(tutar);
}

interface Props {
  ihaleId: string;
  mevcutTeklif: number | null;
  olusturanId?: string | null;
  teklifler: { kullanici_id?: string }[];
  bittiMi: boolean;
  boyut?: "kompakt" | "buyuk";
}

export default function EnDusukTeklif({ ihaleId, mevcutTeklif, olusturanId, teklifler, bittiMi, boyut = "kompakt" }: Props) {
  const gercekMi = gercekIhaleIdMi(ihaleId);

  // Mock/demo ihaleler icin eski (basit, sahte veri uzerinde calisan) kural;
  // gercek ihaleler icin RLS/RPC ile gercekten erisim kontrollu veri.
  const mockErisim = useTeklifRaporuErisimi({ olusturanId, teklifler, bittiMi: gercekMi ? false : bittiMi });
  const gercekErisim = useGercekTeklifErisimi(ihaleId, bittiMi, olusturanId);

  const erisim = gercekMi
    ? (gercekErisim.durum === "tam" || gercekErisim.durum === "fiyat" ? "izinli" : gercekErisim.durum === "yukleniyor" ? "yukleniyor" : "kilitli")
    : mockErisim;
  const gercekEnDusuk = gercekMi && gercekErisim.fiyatlar.length > 0 ? Math.min(...gercekErisim.fiyatlar) : null;
  const gosterilecekTutar = gercekMi ? gercekEnDusuk : mevcutTeklif;

  const kilitliMesaj = bittiMi
    ? (gercekMi
        ? "Bu bilgiyi yalnızca ihale sahibi ya da Kurumsal plan kullanıcıları görebilir."
        : "Bu bilgiyi görmek için ihaleye teklif vermiş olmalı ya da Kurumsal plana sahip olmalısınız.")
    : "İhale devam ederken bu bilgi kimseye gösterilmez — ihale sahibi dahil.";

  if (boyut === "buyuk") {
    return (
      <div className="bg-blue-50 rounded-lg p-4">
        <p className="text-xs text-blue-500 mb-1">Güncel En Düşük Teklif</p>
        {erisim === "yukleniyor" ? (
          <div className="h-8 w-32 bg-blue-100 rounded animate-pulse" />
        ) : erisim === "izinli" ? (
          <>
            <p className="text-2xl font-bold text-blue-700">
              {gosterilecekTutar ? formatPara(gosterilecekTutar) : "—"}
            </p>
            {!gosterilecekTutar && (
              <p className="text-xs text-blue-400 mt-1">Henüz teklif yok</p>
            )}
          </>
        ) : (
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 10-8 0v4h8z" />
            </svg>
            <div>
              <span className="text-sm font-semibold text-blue-700">{kilitliMesaj}</span>
              {bittiMi && (
                <Link href="/premium" className="block text-xs font-semibold text-amber-600 hover:underline mt-1">
                  Kurumsal plana geçin →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <p className="text-gray-400 text-xs mb-0.5">En Düşük Teklif</p>
      {erisim === "yukleniyor" ? (
        <div className="h-5 w-24 bg-gray-100 rounded animate-pulse" />
      ) : erisim === "izinli" ? (
        <p className="font-semibold text-blue-700">
          {gosterilecekTutar ? formatPara(gosterilecekTutar) : "Henüz yok"}
        </p>
      ) : bittiMi ? (
        <Link
          href="/premium"
          className="flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-700"
        >
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 10-8 0v4h8z" />
          </svg>
          Üst plana geçin
        </Link>
      ) : (
        <span className="flex items-center gap-1 text-xs font-medium text-gray-400" title={kilitliMesaj}>
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 10-8 0v4h8z" />
          </svg>
          İhale bitince görünür
        </span>
      )}
    </div>
  );
}
