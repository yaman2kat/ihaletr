"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Ihale, IhaleDurumu } from "@/lib/types";

// ─── Yardımcı tür ────────────────────────────────────────────────────────────

interface PanelTeklif {
  id: string;
  ihale_id: string;
  tutar: number;
  durum: string;
  created_at: string;
  ihale?: { baslik: string; bitis_tarihi: string; durum: IhaleDurumu };
}

// ─── Yardımcı fonksiyonlar ───────────────────────────────────────────────────

function kalanGun(bitis: string) {
  const fark = new Date(bitis).getTime() - Date.now();
  return Math.max(0, Math.floor(fark / (1000 * 60 * 60 * 24)));
}

function kalanSure(bitis: string): string {
  const fark = new Date(bitis).getTime() - Date.now();
  if (fark <= 0) return "Sona erdi";
  const gun = Math.floor(fark / (1000 * 60 * 60 * 24));
  const saat = Math.floor((fark % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (gun > 0) return `${gun} gün ${saat} saat`;
  return `${saat} saat`;
}

function tarihFormat(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

function paraBirim(tutar: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(tutar);
}

const DURUM_BADGE: Record<IhaleDurumu, { etiket: string; cls: string }> = {
  aktif:       { etiket: "Aktif",       cls: "bg-green-100 text-green-700" },
  beklemede:   { etiket: "Beklemede",   cls: "bg-yellow-100 text-yellow-700" },
  tamamlandi:  { etiket: "Tamamlandı",  cls: "bg-gray-100 text-gray-600" },
  iptal:       { etiket: "İptal",       cls: "bg-red-100 text-red-600" },
};

// ─── Sekme tipi ──────────────────────────────────────────────────────────────

type Sekme = "ihaleler" | "teklifler";

// ─── Ana bileşen ─────────────────────────────────────────────────────────────

export default function PanelSayfasi() {
  const router      = useRouter();
  const searchParams = useSearchParams();
  const [kullanici,  setKullanici]  = useState<User | null | undefined>(undefined);
  const [odemeBildirim, setOdemeBildirim] = useState(false);
  const [ihaleler,   setIhaleler]   = useState<Ihale[]>([]);
  const [teklifler,  setTeklifler]  = useState<PanelTeklif[]>([]);
  const [kalanHak,   setKalanHak]   = useState<number | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [sekme,      setSekme]      = useState<Sekme>("ihaleler");
  const [siliniyor,  setSiliniyor]  = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    async function yukle() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.replace("/giris"); return; }
      setKullanici(session.user);

      const [ihaleRes, teklifRes, profilRes] = await Promise.all([
        supabase.from("ihaleler").select("*")
          .eq("olusturan_id", session.user.id)
          .order("created_at", { ascending: false }),
        supabase.from("teklifler")
          .select("*, ihale:ihaleler(baslik, bitis_tarihi, durum)")
          .eq("kullanici_id", session.user.id)
          .order("created_at", { ascending: false }),
        supabase.from("kullanicilar")
          .select("kalan_teklif_hakki")
          .eq("id", session.user.id)
          .single(),
      ]);

      setIhaleler((ihaleRes.data ?? []) as Ihale[]);
      setTeklifler((teklifRes.data ?? []) as PanelTeklif[]);
      setKalanHak(profilRes.data?.kalan_teklif_hakki ?? 2);

      setYukleniyor(false);
    }
    yukle();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace("/giris");
      else setKullanici(session.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Ödeme başarı bildirimi
  useEffect(() => {
    if (searchParams.get("odeme") === "basarili") {
      setOdemeBildirim(true);
      const t = setTimeout(() => setOdemeBildirim(false), 6000);
      return () => clearTimeout(t);
    }
  }, [searchParams]);

  async function handleSil(id: string) {
    if (!confirm("Bu ihaleyi silmek istediğinizden emin misiniz?")) return;
    setSiliniyor(id);
    await supabase.from("ihaleler").delete().eq("id", id);
    setIhaleler((p) => p.filter((x) => x.id !== id));
    setSiliniyor(null);
  }

  // ─── İstatistikler ───────────────────────────────────────────────────────

  const aktifIhaleler   = ihaleler.filter((x) => x.durum === "aktif");
  const toplamGorunum   = ihaleler.reduce((s, x) => s + (x.goruntulenme_sayisi ?? 0), 0);
  const yaklasanIhaleler = aktifIhaleler.filter((x) => kalanGun(x.bitis_tarihi) < 5);

  // ─── Yükleniyor ──────────────────────────────────────────────────────────

  if (kullanici === undefined || yukleniyor) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="h-8 bg-gray-200 rounded w-48 mb-8 animate-pulse" />
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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

      {/* ─── Başlık ─── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Panelim</h1>
          <p className="text-gray-500 text-sm mt-0.5">{kullanici?.email}</p>
        </div>
        <Link
          href="/ihale-olustur"
          className="flex items-center gap-2 bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-800 transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Yeni İhale
        </Link>
      </div>

      {/* ─── Ödeme Başarı Bildirimi ─── */}
      {odemeBildirim && (
        <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 mb-5 flex items-center gap-4">
          <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-green-800">Ödeme başarıyla tamamlandı!</p>
            <p className="text-xs text-green-700 mt-0.5">Paketiniz hesabınıza tanımlandı, anında kullanıma hazır.</p>
          </div>
          <button
            onClick={() => setOdemeBildirim(false)}
            className="text-green-500 hover:text-green-700 p-1 rounded-lg hover:bg-green-100 transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ─── Premium Uyarısı ─── */}
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
            Premium'a Geç →
          </Link>
        </div>
      )}

      {/* ─── İstatistik Kartları ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
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
          <p className="text-2xl font-bold text-purple-700">{teklifler.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Verilen Teklif</p>
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

        {/* Kalan teklif hakkı */}
        <Link href="/teklif-paketi"
          className={`bg-white rounded-2xl border shadow-sm p-5 hover:shadow-md transition-shadow block ${
            kalanHak === 0 ? "border-red-200 bg-red-50/30" :
            kalanHak !== null && kalanHak <= 2 ? "border-amber-200 bg-amber-50/30" :
            "border-gray-200"
          }`}>
          <div className={`w-9 h-9 rounded-xl mb-3 flex items-center justify-center ${
            kalanHak === 0 ? "bg-red-100" :
            kalanHak !== null && kalanHak <= 2 ? "bg-amber-100" : "bg-teal-50"
          }`}>
            <svg className={`w-5 h-5 ${
              kalanHak === 0 ? "text-red-500" :
              kalanHak !== null && kalanHak <= 2 ? "text-amber-500" : "text-teal-600"
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className={`text-2xl font-bold ${
            kalanHak === 0 ? "text-red-600" :
            kalanHak !== null && kalanHak <= 2 ? "text-amber-600" : "text-teal-600"
          }`}>
            {kalanHak === null ? "…" : kalanHak >= 99999 ? "∞" : kalanHak}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Teklif Hakkı</p>
          {kalanHak === 0 && (
            <p className="text-[10px] text-red-500 font-semibold mt-1">Paket satın al →</p>
          )}
        </Link>
      </div>

      {/* ─── Sekmeler ─── */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
        {([["ihaleler", "İhalelerim"], ["teklifler", "Tekliflerim"]] as [Sekme, string][]).map(([k, e]) => (
          <button key={k} onClick={() => setSekme(k)}
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all ${
              sekme === k ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}>
            {e}
            <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
              sekme === k ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-500"
            }`}>
              {k === "ihaleler" ? ihaleler.length : teklifler.length}
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
                        {/* Başlık satırı */}
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
                          {yaklasiyor && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                              ⚠ {kalan} gün kaldı
                            </span>
                          )}
                        </div>

                        {/* Meta bilgiler */}
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

                      {/* Fiyat */}
                      <div className="hidden sm:block text-right flex-shrink-0">
                        <p className="text-xs text-gray-400 mb-0.5">Başlangıç</p>
                        <p className="text-sm font-bold text-gray-900">{paraBirim(ihale.baslangic_fiyati)}</p>
                        {ihale.mevcut_teklif && (
                          <p className="text-xs text-green-600 font-medium">{paraBirim(ihale.mevcut_teklif)} tekl.</p>
                        )}
                      </div>

                      {/* Aksiyonlar */}
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
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── TEKLİFLER Sekmesi ─── */}
      {sekme === "teklifler" && (
        <div>
          {teklifler.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <p className="text-3xl mb-3">💬</p>
              <p className="text-gray-600 font-medium mb-2">Henüz teklif vermediniz</p>
              <Link href="/ihaleler" className="text-blue-600 font-semibold hover:underline text-sm">
                İhalelere göz at →
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">İhale</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Teklif Tutarı</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Tarih</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {teklifler.map((t) => {
                    const ihaleBitti = t.ihale?.bitis_tarihi
                      ? new Date(t.ihale.bitis_tarihi) < new Date()
                      : false;
                    return (
                      <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-4">
                          <Link
                            href={`/ihaleler/${t.ihale_id}`}
                            className="font-medium text-gray-900 hover:text-blue-700 transition-colors line-clamp-1"
                          >
                            {t.ihale?.baslik ?? "İhale"}
                          </Link>
                          {t.ihale?.bitis_tarihi && (
                            <p className="text-xs text-gray-400 mt-0.5">Bitiş: {tarihFormat(t.ihale.bitis_tarihi)}</p>
                          )}
                        </td>
                        <td className="px-5 py-4 hidden sm:table-cell">
                          <span className="font-semibold text-gray-900">{paraBirim(t.tutar)}</span>
                        </td>
                        <td className="px-5 py-4 hidden md:table-cell text-gray-500 text-xs">
                          {tarihFormat(t.created_at)}
                        </td>
                        <td className="px-5 py-4">
                          {ihaleBitti ? (
                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-500">Sona Erdi</span>
                          ) : t.durum === "kabul_edildi" ? (
                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700">Kabul Edildi</span>
                          ) : t.durum === "reddedildi" ? (
                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-red-100 text-red-600">Reddedildi</span>
                          ) : (
                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-700">Değerlendirmede</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
