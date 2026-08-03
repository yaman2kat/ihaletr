"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Ihale, PlanTuru } from "@/lib/types";
import { PLAN_MAKS_IHALE_GUNU } from "@/lib/plan-limitleri";
import { kalanGun, kalanSure, tarihFormat, paraBirim, DURUM_BADGE } from "./utils";

const PLAN_BADGE: Record<PlanTuru, { etiket: string; cls: string }> = {
  ucretsiz: { etiket: "Ücretsiz", cls: "bg-gray-100 text-gray-600" },
  premium:  { etiket: "Premium",  cls: "bg-blue-100 text-blue-700" },
  kurumsal: { etiket: "Kurumsal", cls: "bg-purple-100 text-purple-700" },
};

interface GelenTeklif {
  id: string;
  ihale_id: string;
  tutar: number;
  durum: string;
  created_at: string;
  ihale?: { baslik: string };
  teklif_veren?: { ad_soyad: string; firma_adi: string | null } | null;
}

type Sekme = "ihaleler" | "gelenTeklifler";

interface ArsaSahibiPanelProps {
  userId: string;
}

export default function ArsaSahibiPanel({ userId }: ArsaSahibiPanelProps) {
  const [ihaleler,       setIhaleler]       = useState<Ihale[]>([]);
  const [gelenTeklifler, setGelenTeklifler] = useState<GelenTeklif[]>([]);
  const [planTuru,       setPlanTuru]       = useState<PlanTuru>("ucretsiz");
  const [yukleniyor,     setYukleniyor]     = useState(true);
  const [sekme,          setSekme]          = useState<Sekme>("ihaleler");
  const [siliniyor,      setSiliniyor]      = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    async function yukle() {
      const { data: profilData } = await supabase.from("kullanicilar")
        .select("plan_turu")
        .eq("id", userId)
        .single();
      setPlanTuru((profilData?.plan_turu as PlanTuru) ?? "ucretsiz");

      const { data: ihaleData } = await supabase.from("ihaleler").select("*")
        .eq("olusturan_id", userId)
        .order("created_at", { ascending: false });

      const ihaleListesi = (ihaleData ?? []) as Ihale[];
      setIhaleler(ihaleListesi);

      const ihaleIdleri = ihaleListesi.map((x) => x.id);
      if (ihaleIdleri.length > 0) {
        const { data: teklifData } = await supabase
          .from("teklifler")
          .select("*, ihale:ihaleler(baslik), teklif_veren:kullanicilar(ad_soyad, firma_adi)")
          .in("ihale_id", ihaleIdleri)
          .order("created_at", { ascending: false });
        setGelenTeklifler((teklifData ?? []) as GelenTeklif[]);
      }

      setYukleniyor(false);
    }
    yukle();
  }, [userId]);

  async function handleSil(id: string) {
    if (!confirm("Bu ihaleyi silmek istediğinizden emin misiniz?")) return;
    setSiliniyor(id);
    await supabase.from("ihaleler").delete().eq("id", id);
    setIhaleler((p) => p.filter((x) => x.id !== id));
    setSiliniyor(null);
  }

  const aktifIhaleler    = ihaleler.filter((x) => x.durum === "aktif");
  const toplamGorunum    = ihaleler.reduce((s, x) => s + (x.goruntulenme_sayisi ?? 0), 0);
  const yaklasanIhaleler = aktifIhaleler.filter((x) => kalanGun(x.bitis_tarihi) < 5);

  if (yukleniyor) {
    return (
      <div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-white border border-gray-200 rounded-2xl animate-pulse" />)}
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-white border border-gray-200 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ─── Yaklaşan Süre Uyarısı ─── */}
      {yaklasanIhaleler.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-6 flex items-start gap-4">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800 mb-0.5">
              {yaklasanIhaleler.length === 1
                ? "1 ihalenizin süresi 5 günden az kaldı"
                : `${yaklasanIhaleler.length} ihalenizin süresi 5 günden az kaldı`}
            </p>
            <p className="text-xs text-amber-700">
              {yaklasanIhaleler.map((x) => x.baslik).join(", ")}
            </p>
          </div>
          <Link href="/premium"
            className="flex-shrink-0 bg-amber-500 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-amber-600 transition-colors whitespace-nowrap">
            Premium&apos;a Geç →
          </Link>
        </div>
      )}

      {/* ─── Plan Bilgisi (yalnızca arsa sahibiyle ilgili) ─── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${PLAN_BADGE[planTuru].cls}`}>
            {PLAN_BADGE[planTuru].etiket}
          </span>
          <p className="text-sm text-gray-500">
            İhalelerinizde en fazla <span className="font-semibold text-gray-900">{PLAN_MAKS_IHALE_GUNU[planTuru]} gün</span> süre tanımlayabilirsiniz
          </p>
        </div>
        {planTuru !== "kurumsal" && (
          <Link href="/premium" className="text-xs font-bold text-blue-700 hover:underline whitespace-nowrap">
            Planı Yükselt →
          </Link>
        )}
      </div>

      {/* ─── İstatistik Kartları ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="w-9 h-9 rounded-xl mb-3 flex items-center justify-center bg-blue-50">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-2xl font-bold text-blue-700">{ihaleler.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Toplam İhale</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="w-9 h-9 rounded-xl mb-3 flex items-center justify-center bg-green-50">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-2xl font-bold text-green-700">{aktifIhaleler.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Aktif İhale</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="w-9 h-9 rounded-xl mb-3 flex items-center justify-center bg-purple-50">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
          </div>
          <p className="text-2xl font-bold text-purple-700">{gelenTeklifler.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Gelen Teklif</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="w-9 h-9 rounded-xl mb-3 flex items-center justify-center bg-orange-50">
            <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <p className="text-2xl font-bold text-orange-600">{toplamGorunum}</p>
          <p className="text-xs text-gray-500 mt-0.5">Toplam Görüntüleme</p>
        </div>
      </div>

      {/* ─── Sekmeler ─── */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
        {([["ihaleler", "İhalelerim"], ["gelenTeklifler", "Gelen Teklifler"]] as [Sekme, string][]).map(([k, e]) => (
          <button key={k} onClick={() => setSekme(k)}
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all ${
              sekme === k ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}>
            {e}
            <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
              sekme === k ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-500"
            }`}>
              {k === "ihaleler" ? ihaleler.length : gelenTeklifler.length}
            </span>
          </button>
        ))}
      </div>

      {/* ─── İHALELER Sekmesi ─── */}
      {sekme === "ihaleler" && (
        <div>
          {ihaleler.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <p className="text-3xl mb-3">📋</p>
              <p className="text-gray-600 font-medium mb-2">Henüz ihale oluşturmadınız</p>
              <Link href="/ihale-olustur" className="text-blue-600 font-semibold hover:underline text-sm">
                İlk ihaleyi oluştur →
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {ihaleler.map((ihale) => {
                const badge = DURUM_BADGE[ihale.durum];
                const kalan = kalanGun(ihale.bitis_tarihi);
                const yaklasiyor = ihale.durum === "aktif" && kalan < 5;
                return (
                  <div
                    key={ihale.id}
                    className={`bg-white rounded-2xl border shadow-sm p-5 transition-all ${
                      yaklasiyor ? "border-amber-300 bg-amber-50/30" : "border-gray-200"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <Link
                            href={`/ihaleler/${ihale.id}`}
                            className="font-semibold text-gray-900 hover:text-blue-700 transition-colors text-sm"
                          >
                            {ihale.baslik}
                          </Link>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>
                            {badge.etiket}
                          </span>
                          {ihale.inceleme_durumu === "reddedildi" && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                              ⚠ Reddedildi
                            </span>
                          )}
                          {ihale.inceleme_durumu === "beklemede" && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                              İnceleniyor
                            </span>
                          )}
                          {yaklasiyor && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                              ⚠ {kalan} gün kaldı
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            {ihale.goruntulenme_sayisi ?? 0} görüntüleme
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                            </svg>
                            {ihale.mevcut_teklif ? "Teklif var" : "Teklif yok"}
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {tarihFormat(ihale.bitis_tarihi)} bitiş
                          </span>
                          {ihale.durum === "aktif" && (
                            <span className="font-medium text-blue-600">{kalanSure(ihale.bitis_tarihi)}</span>
                          )}
                        </div>
                      </div>

                      <div className="hidden sm:block text-right flex-shrink-0">
                        <p className="text-xs text-gray-400 mb-0.5">Başlangıç</p>
                        <p className="text-sm font-bold text-gray-900">{paraBirim(ihale.baslangic_fiyati)}</p>
                        {ihale.mevcut_teklif && (
                          <p className="text-xs text-green-600 font-medium">{paraBirim(ihale.mevcut_teklif)} tekl.</p>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/ihaleler/${ihale.id}`}
                            className="text-xs text-blue-600 hover:underline font-medium"
                          >
                            Görüntüle
                          </Link>
                          <button
                            onClick={() => handleSil(ihale.id)}
                            disabled={siliniyor === ihale.id}
                            className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-40"
                          >
                            {siliniyor === ihale.id ? "…" : "Sil"}
                          </button>
                        </div>
                        {yaklasiyor && (
                          <Link
                            href="/premium"
                            className="text-[11px] font-bold bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap"
                          >
                            Süreyi Uzat →
                          </Link>
                        )}
                      </div>
                    </div>

                    {ihale.inceleme_durumu === "reddedildi" && ihale.red_sebebi && (
                      <div className="mt-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                        <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div>
                          <p className="text-xs font-semibold text-red-800 mb-0.5">İhaleniz reddedildi</p>
                          <p className="text-xs text-red-700">{ihale.red_sebebi}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── GELEN TEKLİFLER Sekmesi ─── */}
      {sekme === "gelenTeklifler" && (
        <div>
          {gelenTeklifler.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <p className="text-3xl mb-3">📬</p>
              <p className="text-gray-600 font-medium mb-2">İhalelerinize henüz teklif gelmedi</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">İhale</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Teklif Veren</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Tutar</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Tarih</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {gelenTeklifler.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4">
                        <Link
                          href={`/ihaleler/${t.ihale_id}`}
                          className="font-medium text-gray-900 hover:text-blue-700 transition-colors line-clamp-1"
                        >
                          {t.ihale?.baslik ?? "İhale"}
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-gray-700">
                        {t.teklif_veren?.firma_adi || t.teklif_veren?.ad_soyad || "Misafir"}
                      </td>
                      <td className="px-5 py-4 hidden sm:table-cell">
                        <span className="font-semibold text-gray-900">{paraBirim(t.tutar)}</span>
                      </td>
                      <td className="px-5 py-4 hidden md:table-cell text-gray-500 text-xs">
                        {tarihFormat(t.created_at)}
                      </td>
                      <td className="px-5 py-4">
                        {t.durum === "kabul_edildi" ? (
                          <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700">Kabul Edildi</span>
                        ) : t.durum === "reddedildi" ? (
                          <span className="text-xs font-medium px-2 py-1 rounded-full bg-red-100 text-red-600">Reddedildi</span>
                        ) : (
                          <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-700">Değerlendirmede</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
