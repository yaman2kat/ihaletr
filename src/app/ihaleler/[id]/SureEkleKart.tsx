"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { PlanTuru } from "@/lib/types";
import { PLAN_UZATMA_LIMITI, gunFarki, tarihiGunEkleyerekUzat, formatTarih } from "@/lib/ihale-sonuc";

interface Props {
  ihaleId: string;
  olusturanId: string | null | undefined;
  durum: string;
  baslangicTarihi: string;
  bitisTarihi: string;
}

// "İhaleyi Uzat" / "Süre Ekle" — GÖRÜNÜRLÜK KURALLARI (her iki plan için
// de kesin olarak uygulanır):
//   1) SADECE ihaleyi oluşturan kişiye görünür (kurumsal/admin dahil
//      başka HİÇ KİMSEYE görünmez).
//   2) SADECE ihale hâlâ aktifken (durum='aktif' VE bitis_tarihi henüz
//      geçmemişken) görünür. Süre dolduktan, kazanan seçildikten ya da
//      ihale tamamlandıktan sonra bu bileşen hiçbir şey render etmez --
//      "İhale Sonucu" raporunda ayrıca bir uzatma seçeneği YOKTUR,
//      uzatma yalnızca burada, ihale bittiği anda tamamen kaybolur.
// Premium: 45 günlük dağıtılabilir uzatma havuzundan gün düşer (RPC).
// Kurumsal: eski elapsed-day tavanlı mantık (PLAN_UZATMA_LIMITI),
// doğrudan client update ile.
export default function SureEkleKart({ ihaleId, olusturanId, durum, baslangicTarihi, bitisTarihi }: Props) {
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

  // Kurumsal'in elapsed-day tavanli hesaplamasi -- premium icin de
  // zararsizca hesaplanir (kullanilmaz), erken return'lerden bagimsiz
  // her zaman tanimli olsun diye kosulsuz yapilir.
  const gecenGun = gunFarki(baslangicTarihi, bitisTarihi);
  const kurumsalPlanLimiti = PLAN_UZATMA_LIMITI.kurumsal ?? 0;
  const kurumsalKalanHak = Math.max(0, kurumsalPlanLimiti - gecenGun);

  const kalanGun = Math.ceil((new Date(bitisTarihi).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const halaAktifMi = durum === "aktif" && kalanGun > 0;

  if (!sahibiMi || !halaAktifMi || (planTuru !== "premium" && planTuru !== "kurumsal")) {
    return null;
  }

  async function uzat() {
    setHata("");
    const eklenecekGun = Number(gun);
    if (!eklenecekGun || eklenecekGun <= 0) { setHata("Geçerli bir gün sayısı girin."); return; }

    setGonderiliyor(true);

    if (planTuru === "premium") {
      if (eklenecekGun > havuz) { setHata(`Uzatma havuzunuzda en fazla ${havuz} gün var.`); setGonderiliyor(false); return; }
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
      return;
    }

    // Kurumsal: dogrudan client update. durum + bitis_tarihi>bugun
    // eslesme kontrolu -- ihale, form doldurulurken pg_cron tarafindan
    // zaten otomatik sonlandirilmis ya da suresi gecmis olabilir; bu
    // durumda uzatma sessizce reddedilir, "ihale bittikten sonra hicbir
    // sekilde uzatma yapilamaz" kurali sunucu tarafinda da garanti edilir.
    if (eklenecekGun > kurumsalKalanHak) { setHata(`En fazla ${kurumsalKalanHak} gün uzatabilirsiniz.`); setGonderiliyor(false); return; }
    const yeniBitisTarihi = tarihiGunEkleyerekUzat(bitisTarihi, eklenecekGun);
    const bugunIso = new Date().toISOString().split("T")[0];
    const supabase = createClient();
    const { data, error } = await supabase
      .from("ihaleler")
      .update({ bitis_tarihi: yeniBitisTarihi })
      .eq("id", ihaleId)
      .eq("durum", "aktif")
      .gt("bitis_tarihi", bugunIso)
      .select("id");
    setGonderiliyor(false);
    if (error) { setHata("İhale uzatılamadı: " + error.message); return; }
    if (!data || data.length === 0) {
      setHata("Bu ihale artık aktif değil — süresi dolmuş olabilir, uzatılamaz.");
      return;
    }
    setBasariliTarih(yeniBitisTarihi);
    router.refresh();
  }

  if (basariliTarih) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center text-sm text-green-700">
        İhale başarıyla uzatıldı. Yeni son teklif tarihi: <strong>{formatTarih(basariliTarih)}</strong>
      </div>
    );
  }

  // ── Premium: havuz modeli ──────────────────────────────────────────
  if (planTuru === "premium") {
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
            type="number" min={1} max={havuz}
            value={gun} onChange={(e) => setGun(e.target.value)}
            placeholder={`1-${havuz} gün`}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button" disabled={gonderiliyor} onClick={uzat}
            className="bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg text-sm hover:bg-blue-800 disabled:opacity-50 transition-colors"
          >
            {gonderiliyor ? "Ekleniyor..." : "Süre Ekle"}
          </button>
        </div>
      </div>
    );
  }

  // ── Kurumsal: eski elapsed-day tavanlı mantik ───────────────────────
  if (kurumsalKalanHak <= 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center text-sm text-gray-500">
        Bu ihale, planınızın izin verdiği toplam {kurumsalPlanLimiti} günlük süreye zaten ulaştı.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">İhaleyi Uzat</p>
      <p className="text-sm text-gray-600 mb-3">
        Planınız (<strong>Kurumsal</strong>) toplamda en fazla {kurumsalPlanLimiti} gün ihale süresine izin verir.
        Bu ihale şu ana kadar {gecenGun} gün sürdü; en fazla <strong>{kurumsalKalanHak} gün</strong> daha uzatabilirsiniz.
      </p>
      {hata && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-2.5 mb-3">{hata}</div>
      )}
      <div className="flex gap-2">
        <input
          type="number" min={1} max={kurumsalKalanHak}
          value={gun} onChange={(e) => setGun(e.target.value)}
          placeholder={`1-${kurumsalKalanHak} gün`}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button" disabled={gonderiliyor} onClick={uzat}
          className="bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg text-sm hover:bg-blue-800 disabled:opacity-50 transition-colors"
        >
          {gonderiliyor ? "Uzatılıyor..." : "Uzat"}
        </button>
      </div>
    </div>
  );
}
