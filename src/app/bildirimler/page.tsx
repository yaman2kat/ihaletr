"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Bildirim, BildirimTuru } from "@/lib/types";

const SAYFA_BOYUTU = 20;

const TUR_IKON: Record<string, string> = {
  yeni_teklif: "📩",
  ihale_onaylandi: "✅",
  ihale_reddedildi: "⛔",
  ihale_otomatik_sonlandi: "⏱️",
  davet_odulu: "🎁",
  odeme_sorunu: "⚠️",
  bolge_eslesmesi: "📍",
};

type Kategori = "tumu" | "teklif" | "ihale" | "davet" | "odeme";

const KATEGORI_TURLERI: Record<Exclude<Kategori, "tumu">, BildirimTuru[]> = {
  teklif: ["yeni_teklif"],
  ihale: ["ihale_onaylandi", "ihale_reddedildi", "ihale_otomatik_sonlandi", "bolge_eslesmesi"],
  davet: ["davet_odulu"],
  odeme: ["odeme_sorunu"],
};

const KATEGORILER: { deger: Kategori; etiket: string }[] = [
  { deger: "tumu", etiket: "Tümü" },
  { deger: "teklif", etiket: "Teklif" },
  { deger: "ihale", etiket: "İhale" },
  { deger: "davet", etiket: "Davet" },
  { deger: "odeme", etiket: "Ödeme" },
];

function goreliZaman(iso: string): string {
  const farkMs = Date.now() - new Date(iso).getTime();
  const dk = Math.floor(farkMs / 60000);
  if (dk < 1) return "az önce";
  if (dk < 60) return `${dk} dk önce`;
  const saat = Math.floor(dk / 60);
  if (saat < 24) return `${saat} sa önce`;
  const gun = Math.floor(saat / 24);
  return `${gun} gün önce`;
}

export default function BildirimlerSayfasi() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [bildirimler, setBildirimler] = useState<Bildirim[]>([]);
  const [toplamSayi, setToplamSayi] = useState(0);
  const [kategori, setKategori] = useState<Kategori>("tumu");
  const [sayfa, setSayfa] = useState(1);
  const [yukleniyor, setYukleniyor] = useState(true);

  const toplamSayfa = Math.max(1, Math.ceil(toplamSayi / SAYFA_BOYUTU));

  const yukle = useCallback(async (uid: string, kat: Kategori, s: number) => {
    setYukleniyor(true);
    const supabase = createClient();
    let sorgu = supabase.from("bildirimler").select("*", { count: "exact" }).order("created_at", { ascending: false });
    if (kat !== "tumu") sorgu = sorgu.in("tur", KATEGORI_TURLERI[kat]);
    const from = (s - 1) * SAYFA_BOYUTU;
    const to = from + SAYFA_BOYUTU - 1;
    const { data, count } = await sorgu.range(from, to);
    setBildirimler((data ?? []) as Bildirim[]);
    setToplamSayi(count ?? 0);
    setYukleniyor(false);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { router.replace("/giris?next=" + encodeURIComponent("/bildirimler")); return; }
      setUserId(session.user.id);
      yukle(session.user.id, kategori, 1);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  function kategoriDegistir(k: Kategori) {
    setKategori(k);
    setSayfa(1);
    if (userId) yukle(userId, k, 1);
  }

  function sayfaDegistir(s: number) {
    setSayfa(s);
    if (userId) yukle(userId, kategori, s);
  }

  async function tumunuOkunduIsaretle() {
    if (!userId) return;
    setBildirimler((onceki) => onceki.map((b) => ({ ...b, okundu: true })));
    const supabase = createClient();
    await supabase.from("bildirimler").update({ okundu: true }).eq("kullanici_id", userId).eq("okundu", false);
  }

  async function bildirimeTikla(b: Bildirim) {
    if (!b.okundu) {
      setBildirimler((onceki) => onceki.map((x) => (x.id === b.id ? { ...x, okundu: true } : x)));
      const supabase = createClient();
      await supabase.from("bildirimler").update({ okundu: true }).eq("id", b.id);
    }
    if (b.link) router.push(b.link);
  }

  const okunmamisVarMi = bildirimler.some((b) => !b.okundu);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">Bildirimler</h1>
        {okunmamisVarMi && (
          <button
            onClick={tumunuOkunduIsaretle}
            className="text-sm text-blue-700 font-medium hover:underline"
          >
            Tümünü okundu işaretle
          </button>
        )}
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6 flex-wrap">
        {KATEGORILER.map((k) => (
          <button
            key={k.deger}
            onClick={() => kategoriDegistir(k.deger)}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              kategori === k.deger ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {k.etiket}
          </button>
        ))}
      </div>

      {yukleniyor ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((n) => <div key={n} className="h-20 bg-white border border-gray-200 rounded-xl animate-pulse" />)}
        </div>
      ) : bildirimler.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-16 text-center">
          <p className="text-gray-400">Bu kategoride bildirim yok.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {bildirimler.map((b) => (
            <button
              key={b.id}
              onClick={() => bildirimeTikla(b)}
              className={`w-full text-left flex items-start gap-4 px-5 py-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors ${!b.okundu ? "bg-blue-50/40" : ""}`}
            >
              <span className="text-xl flex-shrink-0 mt-0.5">{TUR_IKON[b.tur] ?? "🔔"}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${!b.okundu ? "font-semibold text-gray-900" : "font-medium text-gray-700"}`}>{b.baslik}</p>
                <p className="text-sm text-gray-500 mt-0.5">{b.mesaj}</p>
                <p className="text-xs text-gray-400 mt-1.5">{goreliZaman(b.created_at)}</p>
              </div>
              {!b.okundu && <span className="w-2.5 h-2.5 rounded-full bg-blue-600 flex-shrink-0 mt-2" />}
            </button>
          ))}
        </div>
      )}

      {!yukleniyor && toplamSayfa > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-xs text-gray-400">Sayfa {sayfa} / {toplamSayfa} — toplam {toplamSayi} bildirim</p>
          <div className="flex gap-2">
            <button
              onClick={() => sayfaDegistir(Math.max(1, sayfa - 1))}
              disabled={sayfa <= 1}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ← Önceki
            </button>
            <button
              onClick={() => sayfaDegistir(Math.min(toplamSayfa, sayfa + 1))}
              disabled={sayfa >= toplamSayfa}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Sonraki →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
