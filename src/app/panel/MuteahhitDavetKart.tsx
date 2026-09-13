"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  userId: string;
}

// Müteahhit'e özel davet sistemi: arsa sahibi davet ödülü tamamen
// kaldırıldı (bkz. plan_ve_davet_yeniden_yapilandirma_migration.sql).
// Ödül, davet edilen kişi bu kodu kullanarak GERÇEKTEN bir ihaleye
// teklif verdiğinde ya da bir ihale açtığında (davet_kodu_aktivasyonu
// RPC'si, teklif verme/ihale oluşturma formundaki "Davetiye Kodu"
// kutusundan) tanımlanır — ayda en fazla 1 kez.
export default function MuteahhitDavetKart({ userId }: Props) {
  const [davetKodu,  setDavetKodu]  = useState<string | null>(null);
  const [buAySayi,   setBuAySayi]   = useState(0);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [kopyalandi, setKopyalandi] = useState(false);

  useEffect(() => {
    async function yukle() {
      const supabase = createClient();
      const ayYil = new Date().toISOString().slice(0, 7); // YYYY-MM

      const [profilRes, logRes] = await Promise.all([
        supabase.from("kullanicilar").select("davet_kodu").eq("id", userId).single(),
        supabase.from("davet_kullanim_loglari").select("id", { count: "exact", head: true })
          .eq("davet_eden_id", userId).eq("ay_yil", ayYil),
      ]);

      setDavetKodu(profilRes.data?.davet_kodu ?? null);
      setBuAySayi(logRes.count ?? 0);
      setYukleniyor(false);
    }
    yukle();
  }, [userId]);

  async function handleKopyala() {
    if (!davetKodu) return;
    await navigator.clipboard.writeText(davetKodu);
    setKopyalandi(true);
    setTimeout(() => setKopyalandi(false), 2500);
  }

  if (yukleniyor) {
    return <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-8 h-40 animate-pulse" />;
  }

  const limiteUlasildi = buAySayi >= 1;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-8">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">🎁</span>
        <h2 className="text-lg font-bold text-gray-900">Arkadaşını Davet Et</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Davet ettiğiniz kişi, davet kodunuzu kullanarak bir ihaleye teklif verdiğinde veya bir ihale açtığında
        hesabınıza 1 teklif hakkı tanımlanır. Sadece kayıt olması yeterli değildir. Bu yolla ayda en fazla
        1 teklif hakkı kazanabilirsiniz.
      </p>

      {davetKodu && (
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <input
            readOnly
            value={davetKodu}
            onFocus={(e) => e.target.select()}
            className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-gray-700 bg-gray-50 text-sm font-mono tracking-wider"
          />
          <button
            onClick={handleKopyala}
            className="flex-shrink-0 bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-blue-800 transition-colors text-sm"
          >
            {kopyalandi ? "Kopyalandı ✓" : "Kodu Kopyala"}
          </button>
        </div>
      )}

      <div className={`text-sm rounded-lg px-4 py-3 ${
        limiteUlasildi ? "bg-amber-50 border border-amber-200 text-amber-800" : "bg-gray-50 border border-gray-200 text-gray-600"
      }`}>
        {limiteUlasildi
          ? "Bu ay davet limitinize ulaştınız — bir dahaki ay yeniden hak kazanabilirsiniz."
          : "Bu ay henüz davet ödülü kazanmadınız."}
      </div>
    </div>
  );
}
