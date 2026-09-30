"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Ihale } from "@/lib/types";

const KATEGORILER = ["Kentsel Dönüşüm", "Kat Karşılığı", "Yapı İnşaat", "Bakım & Onarım"];

type ErisimDurumu = "yukleniyor" | "izinli" | "girissiz" | "yetkisiz";

interface MaskeliTeklif {
  isim_maskeli: string;
  tutar_maskeli: string | null;
}

function tarihFormat(tarih: string): string {
  return new Date(tarih).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}

function Yukleniyor() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-16 flex flex-col items-center justify-center gap-3">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-400">Yükleniyor...</p>
    </div>
  );
}

function YonlendirmeKarti({ durum }: { durum: "girissiz" | "yetkisiz" }) {
  return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center">
      <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
        <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">İhale Arşivi</h1>
      <p className="text-gray-500 mb-8 leading-relaxed">
        {durum === "girissiz"
          ? "İhale arşivine erişmek için giriş yapmanız gerekiyor."
          : "İhale arşivi yalnızca Kurumsal plan üyelerine açıktır. Tamamlanmış tüm ihalelerin arşivine erişmek, fiyat trendlerini görmek ve referans almak için Kurumsal'a geçin."}
      </p>
      {durum === "girissiz" ? (
        <Link href={`/giris?next=${encodeURIComponent("/ihale-arsivi")}`}
          className="inline-block bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl hover:bg-blue-800 transition-colors">
          Giriş Yap
        </Link>
      ) : (
        <Link href="/premium"
          className="inline-block bg-purple-700 text-white font-semibold px-6 py-3 rounded-xl hover:bg-purple-800 transition-colors">
          Kurumsal Plana Geç →
        </Link>
      )}
    </div>
  );
}

function DetayModal({ ihale, teklifSayisi, onKapat }: { ihale: Ihale; teklifSayisi: number; onKapat: () => void }) {
  const [teklifler, setTeklifler] = useState<MaskeliTeklif[] | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.rpc("ihale_arsiv_teklif_listesi_maskeli", { p_ihale_id: ihale.id }).then(({ data }) => {
      setTeklifler((data ?? []) as MaskeliTeklif[]);
    });
  }, [ihale.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onKapat}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-100 text-purple-700">
              {ihale.kategori}
            </span>
            <h2 className="text-lg font-bold text-gray-900 mt-2 leading-snug">{ihale.baslik}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {ihale.sehir}{ihale.ilce ? ` / ${ihale.ilce}` : ""}
            </p>
          </div>
          <button onClick={onKapat} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-sm text-gray-600 leading-relaxed mb-5">{ihale.aciklama}</p>

        <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-gray-400 text-xs mb-0.5">Tamamlanma Tarihi</p>
            <p className="text-gray-800 font-medium">
              {tarihFormat(ihale.kazanan_secim_tarihi ?? ihale.bitis_tarihi)}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-gray-400 text-xs mb-0.5">Gelen Teklif</p>
            <p className="text-gray-800 font-medium">{teklifSayisi} teklif</p>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Teklifler (firma ve tutar bilgisi gizlilik amacıyla maskelenmiştir)
          </p>
          {teklifler === null ? (
            <div className="space-y-2">
              {[1, 2, 3].map((n) => <div key={n} className="h-9 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : teklifler.length === 0 ? (
            <p className="text-sm text-gray-400">Bu ihaleye ait teklif kaydı bulunamadı.</p>
          ) : (
            <div className="flex flex-col divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
              {teklifler.map((t, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2.5 text-sm">
                  <span className="text-gray-700">{t.isim_maskeli}</span>
                  <span className="text-gray-500 font-medium">{t.tutar_maskeli ?? "Dosya ile teklif"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function IhaleArsiviSayfasi() {
  const [erisim, setErisim] = useState<ErisimDurumu>("yukleniyor");

  const [ihaleler, setIhaleler] = useState<Ihale[]>([]);
  const [teklifSayilari, setTeklifSayilari] = useState<Record<string, number>>({});
  const [veriYukleniyor, setVeriYukleniyor] = useState(true);

  const [arama, setArama] = useState("");
  const [kategori, setKategori] = useState("");
  const [il, setIl] = useState("");
  const [baslangic, setBaslangic] = useState("");
  const [bitis, setBitis] = useState("");
  const [secili, setSecili] = useState<Ihale | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { setErisim("girissiz"); return; }
      const { data } = await supabase.from("kullanicilar").select("plan_turu").eq("id", session.user.id).single();
      setErisim(data?.plan_turu === "kurumsal" ? "izinli" : "yetkisiz");
    });
  }, []);

  useEffect(() => {
    if (erisim !== "izinli") return;
    const supabase = createClient();

    async function yukle() {
      const { data } = await supabase
        .from("ihaleler")
        .select("*")
        .eq("durum", "arsiv")
        .order("kazanan_secim_tarihi", { ascending: false });
      const liste = (data ?? []) as Ihale[];
      setIhaleler(liste);

      const idler = liste.map((i) => i.id);
      if (idler.length > 0) {
        const { data: sayilar } = await supabase.rpc("ihale_teklif_sayilari", { p_ihale_idler: idler });
        setTeklifSayilari(Object.fromEntries(
          (sayilar ?? []).map((s: { ihale_id: string; sayi: number }) => [s.ihale_id, s.sayi])
        ));
      }
      setVeriYukleniyor(false);
    }
    yukle();
  }, [erisim]);

  const ilSecenekleri = useMemo(
    () => [...new Set(ihaleler.map((i) => i.sehir))].sort((a, b) => a.localeCompare(b, "tr")),
    [ihaleler]
  );

  const filtreli = useMemo(() => {
    let sonuc = ihaleler;
    if (arama.trim()) {
      const k = arama.trim().toLowerCase();
      sonuc = sonuc.filter((i) =>
        i.baslik.toLowerCase().includes(k) || i.sehir.toLowerCase().includes(k) || (i.ilce ?? "").toLowerCase().includes(k)
      );
    }
    if (kategori) sonuc = sonuc.filter((i) => i.kategori === kategori);
    if (il) sonuc = sonuc.filter((i) => i.sehir === il);
    if (baslangic) sonuc = sonuc.filter((i) => (i.kazanan_secim_tarihi ?? i.bitis_tarihi) >= baslangic);
    if (bitis) sonuc = sonuc.filter((i) => (i.kazanan_secim_tarihi ?? i.bitis_tarihi) <= bitis);
    return sonuc;
  }, [ihaleler, arama, kategori, il, baslangic, bitis]);

  if (erisim === "yukleniyor") return <Yukleniyor />;
  if (erisim === "girissiz" || erisim === "yetkisiz") return <YonlendirmeKarti durum={erisim} />;

  const SELECT_CLS = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";
  const INPUT_CLS = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full">Kurumsal</span>
          <h1 className="text-3xl font-bold text-gray-900">İhale Arşivi</h1>
        </div>
        <p className="text-gray-500">Tamamlanmış ihalelerin arşivinde fiyat trendlerini ve referansları inceleyin.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="lg:w-72 shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:sticky lg:top-20 flex flex-col gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Ara</p>
              <input
                type="text" placeholder="Başlık, il veya ilçe..."
                value={arama} onChange={(e) => setArama(e.target.value)}
                className={INPUT_CLS}
              />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Kategori</p>
              <select value={kategori} onChange={(e) => setKategori(e.target.value)} className={SELECT_CLS}>
                <option value="">Tüm Kategoriler</option>
                {KATEGORILER.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1.5">İl</p>
              <select value={il} onChange={(e) => setIl(e.target.value)} className={SELECT_CLS}>
                <option value="">Tüm İller</option>
                {ilSecenekleri.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Tamamlanma Tarihi Aralığı</p>
              <div className="grid grid-cols-1 gap-2">
                <input type="date" value={baslangic} onChange={(e) => setBaslangic(e.target.value)} className={INPUT_CLS} />
                <input type="date" value={bitis} onChange={(e) => setBitis(e.target.value)} className={INPUT_CLS} />
              </div>
            </div>
          </div>
        </aside>

        <div className="flex-1">
          {veriYukleniyor ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map((n) => <div key={n} className="bg-gray-100 rounded-xl h-40 animate-pulse" />)}
            </div>
          ) : filtreli.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-16 text-center shadow-sm">
              <p className="text-gray-400 text-lg mb-2">Arşivde sonuç bulunamadı</p>
              <p className="text-gray-400 text-sm">Farklı filtreler deneyin</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filtreli.map((ihale) => (
                <button
                  key={ihale.id}
                  onClick={() => setSecili(ihale)}
                  className="text-left bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-purple-200 transition-all p-6 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-100 text-purple-700">
                      {ihale.kategori}
                    </span>
                    <span className="text-xs text-gray-400">{tarihFormat(ihale.kazanan_secim_tarihi ?? ihale.bitis_tarihi)}</span>
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 leading-snug line-clamp-2">{ihale.baslik}</h3>
                  <p className="text-sm text-gray-400">{ihale.sehir}{ihale.ilce ? ` / ${ihale.ilce}` : ""}</p>
                  <div className="mt-auto pt-2 border-t border-gray-100 flex items-center justify-between text-sm">
                    <span className="text-gray-500">{teklifSayilari[ihale.id] ?? 0} teklif geldi</span>
                    <span className="text-purple-700 font-medium">Detaylar →</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {secili && (
        <DetayModal ihale={secili} teklifSayisi={teklifSayilari[secili.id] ?? 0} onKapat={() => setSecili(null)} />
      )}
    </div>
  );
}
