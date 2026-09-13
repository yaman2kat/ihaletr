"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { PlanTuru } from "@/lib/types";

interface Props {
  ihaleId: string;
  olusturanId: string | null | undefined;
  durum: string;
}

function formatTarih(tarih: string): string {
  return new Date(tarih).toLocaleDateString("tr-TR", {
    day: "numeric", month: "long", year: "numeric",
  });
}

// Premium'un (tek seferlik satın alma) 45 günlük, farklı ihalelere
// dağıtılabilir uzatma havuzundan bu AKTİF ihaleye gün ekler. Kurumsal
// plan bu bileşeni hiç görmez — kendi eski (elapsed-day tavanlı) uzatma
// mekanizması ihale bittikten sonra "İhale Sonucu" raporunda aynen
// çalışmaya devam eder (bkz. IhaleSonucRaporu > UzatmaBolumu).
export default function SureEkleKart({ ihaleId, olusturanId, durum }: Props) {
  const router = useRouter();
  const [sahibiMi, setSahibiMi] = useState<boolean | null>(null);
  const [planTuru, setPlanTuru] = useState<PlanTuru | null>(null);
  const [havuz, setHavuz] = useState<number>(0);
  const [gun, setGun] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [hata, setHata] = useState("");
  const [basariliTarih, setBasariliTarih] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user || session.user.id !== olusturanId) {
        setSahibiMi(false);
        return;
      }
      setSahibiMi(true);
      const { data } = await supabase
        .from("kullanicilar")
        .select("plan_turu, uzatma_havuzu_gun")
        .eq("id", session.user.id)
        .single();
      setPlanTuru((data?.plan_turu as PlanTuru | undefined) ?? null);
      setHavuz(data?.uzatma_havuzu_gun ?? 0);
    });
  }, [olusturanId]);

  if (!sahibiMi || planTuru !== "premium" || durum !== "aktif") {
    return null;
  }

  async function uzat() {
    setHata("");
    const eklenecekGun = Number(gun);
    if (!eklenecekGun || eklenecekGun <= 0) { setHata("Geçerli bir gün sayısı girin."); return; }
    if (eklenecekGun > havuz) { setHata(`Uzatma havuzunuzda en fazla ${havuz} gün var.`); return; }

    setGonderiliyor(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("ihale_suresini_uzat", {
      p_ihale_id: ihaleId,
      p_gun: eklenecekGun,
    });
    setGonderiliyor(false);

    if (error) {
      setHata(
        error.message?.includes("UZATMA_HAVUZU_YETERSIZ")
          ? "Uzatma havuzunuzda yeterli gün yok."
          : "İhale uzatılamadı: " + error.message
      );
      return;
    }

    setHavuz((h) => h - eklenecekGun);
    setBasariliTarih(data as string);
    router.refresh();
  }

  if (basariliTarih) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center text-sm text-green-700">
        İhale başarıyla uzatıldı. Yeni son teklif tarihi: <strong>{formatTarih(basariliTarih)}</strong>
      </div>
    );
  }

  if (havuz <= 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
        <p className="text-sm text-amber-800 mb-2">Uzatma havuzunuzda gün kalmadı.</p>
        <Link href="/premium" className="text-sm font-semibold text-amber-700 hover:underline">Ek havuz için Premium&apos;a bakın →</Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Süre Ekle</p>
      <p className="text-sm text-gray-600 mb-3">
        Uzatma havuzunuzda <strong>{havuz} gün</strong> var. Bu ihaleye eklemek istediğiniz gün sayısını girin —
        havuzunuz farklı ihaleleriniz arasında dilediğiniz gibi paylaştırılabilir.
      </p>
      {hata && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-2.5 mb-3">{hata}</div>
      )}
      <div className="flex gap-2">
        <input
          type="number"
          min={1}
          max={havuz}
          value={gun}
          onChange={(e) => setGun(e.target.value)}
          placeholder={`1-${havuz} gün`}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          disabled={gonderiliyor}
          onClick={uzat}
          className="bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg text-sm hover:bg-blue-800 disabled:opacity-50 transition-colors"
        >
          {gonderiliyor ? "Ekleniyor..." : "Süre Ekle"}
        </button>
      </div>
    </div>
  );
}
