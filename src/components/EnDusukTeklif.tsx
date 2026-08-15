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

// Mock/demo ihaleler icin: eski basit "en dusuk teklif" gorunumu (sahte
// veri, "kazanan" kavramini modellemez).
function MockGorunum({ mevcutTeklif, olusturanId, teklifler, bittiMi, boyut }: {
  mevcutTeklif: number | null; olusturanId?: string | null;
  teklifler: { kullanici_id?: string }[]; bittiMi: boolean; boyut: "kompakt" | "buyuk";
}) {
  const erisim = useTeklifRaporuErisimi({ olusturanId, teklifler, bittiMi });
  const kilitliMesaj = bittiMi
    ? "Bu bilgiyi görmek için ihaleye teklif vermiş olmalı ya da Kurumsal plana sahip olmalısınız."
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
              {mevcutTeklif ? formatPara(mevcutTeklif) : "—"}
            </p>
            {!mevcutTeklif && <p className="text-xs text-blue-400 mt-1">Henüz teklif yok</p>}
          </>
        ) : (
          <div className="flex items-start gap-2">
            <KilitIkonu className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
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
        <p className="font-semibold text-blue-700">{mevcutTeklif ? formatPara(mevcutTeklif) : "Henüz yok"}</p>
      ) : bittiMi ? (
        <Link href="/premium" className="flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-700">
          <KilitIkonu className="w-3.5 h-3.5 flex-shrink-0" />
          Üst plana geçin
        </Link>
      ) : (
        <span className="flex items-center gap-1 text-xs font-medium text-gray-400" title={kilitliMesaj}>
          <KilitIkonu className="w-3.5 h-3.5 flex-shrink-0" />
          İhale bitince görünür
        </span>
      )}
    </div>
  );
}

function KilitIkonu({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 10-8 0v4h8z" />
    </svg>
  );
}

// Gercek ihaleler icin: "kazanan fiyat" gorunumu. Kazanan henuz
// secilmemisse (yetkili olsa bile) BU ALAN HIC GORUNMEZ -- yukseltme
// CTA'si da dahil. Kazanan secilmis ama goruntuleyen yetkisizse kilitli
// mesaj + Kurumsal CTA gosterilir.
function GercekGorunum({ ihaleId, olusturanId, bittiMi, boyut }: {
  ihaleId: string; olusturanId?: string | null; bittiMi: boolean; boyut: "kompakt" | "buyuk";
}) {
  const erisim = useGercekTeklifErisimi(ihaleId, bittiMi, olusturanId);

  if (!bittiMi) {
    const mesaj = "İhale devam ederken bu bilgi kimseye gösterilmez — ihale sahibi dahil.";
    if (boyut === "buyuk") {
      return (
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-xs text-blue-500 mb-1">İhale Sonucu</p>
          <div className="flex items-start gap-2">
            <KilitIkonu className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <span className="text-sm font-semibold text-blue-700">{mesaj}</span>
          </div>
        </div>
      );
    }
    return (
      <div>
        <p className="text-gray-400 text-xs mb-0.5">İhale Sonucu</p>
        <span className="flex items-center gap-1 text-xs font-medium text-gray-400" title={mesaj}>
          <KilitIkonu className="w-3.5 h-3.5 flex-shrink-0" />
          İhale bitince görünür
        </span>
      </div>
    );
  }

  if (erisim.durum === "yukleniyor") {
    return boyut === "buyuk"
      ? <div className="bg-blue-50 rounded-lg p-4"><div className="h-8 w-32 bg-blue-100 rounded animate-pulse" /></div>
      : <div className="h-5 w-24 bg-gray-100 rounded animate-pulse" />;
  }

  // Kazanan henuz secilmemisse -- yetkili olsa bile -- bu alan tamamen gizli.
  if (!erisim.kazananVarMi) return null;

  const yetkiliMi = erisim.durum === "tam" || erisim.durum === "maskeli";

  if (boyut === "buyuk") {
    return (
      <div className="bg-blue-50 rounded-lg p-4">
        <p className="text-xs text-blue-500 mb-1">İhale Sonucu</p>
        {yetkiliMi && erisim.kazananFiyat !== null ? (
          <p className="text-sm font-bold text-blue-700 leading-snug">
            İhale <span className="text-lg">{formatPara(erisim.kazananFiyat)}</span> teklifle tamamlandı.
          </p>
        ) : (
          <div className="flex items-start gap-2">
            <KilitIkonu className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="text-sm font-semibold text-blue-700">
                Bu bilgiyi yalnızca ihale sahibi, teklif veren katılımcılar ve Kurumsal plan kullanıcıları görebilir.
              </span>
              <Link href="/premium" className="block text-xs font-semibold text-amber-600 hover:underline mt-1">
                Kurumsal plana geçin →
              </Link>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <p className="text-gray-400 text-xs mb-0.5">İhale Sonucu</p>
      {yetkiliMi && erisim.kazananFiyat !== null ? (
        <p className="font-semibold text-blue-700 text-sm">{formatPara(erisim.kazananFiyat)} ile tamamlandı</p>
      ) : (
        <Link href="/premium" className="flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-700">
          <KilitIkonu className="w-3.5 h-3.5 flex-shrink-0" />
          Kurumsal plana geçin
        </Link>
      )}
    </div>
  );
}

export default function EnDusukTeklif({ ihaleId, mevcutTeklif, olusturanId, teklifler, bittiMi, boyut = "kompakt" }: Props) {
  const gercekMi = gercekIhaleIdMi(ihaleId);
  if (gercekMi) {
    return <GercekGorunum ihaleId={ihaleId} olusturanId={olusturanId} bittiMi={bittiMi} boyut={boyut} />;
  }
  return <MockGorunum mevcutTeklif={mevcutTeklif} olusturanId={olusturanId} teklifler={teklifler} bittiMi={bittiMi} boyut={boyut} />;
}
