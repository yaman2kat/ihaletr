"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Bildirim } from "@/lib/types";

const TUR_IKON: Record<string, string> = {
  yeni_teklif: "📩",
  ihale_onaylandi: "✅",
  ihale_reddedildi: "⛔",
  ihale_otomatik_sonlandi: "⏱️",
  davet_odulu: "🎁",
  odeme_sorunu: "⚠️",
  bolge_eslesmesi: "📍",
};

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

export default function BildirimZili({ userId }: { userId: string }) {
  const router = useRouter();
  const [bildirimler, setBildirimler] = useState<Bildirim[]>([]);
  const [acik, setAcik] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(true);
  const kutuRef = useRef<HTMLDivElement>(null);

  const okunmamisSayisi = bildirimler.filter((b) => !b.okundu).length;

  useEffect(() => {
    const supabase = createClient();

    async function yukle() {
      const { data } = await supabase
        .from("bildirimler")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      setBildirimler((data ?? []) as Bildirim[]);
      setYukleniyor(false);
    }
    yukle();

    const channel = supabase
      .channel(`bildirimler-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bildirimler", filter: `kullanici_id=eq.${userId}` },
        (payload) => {
          setBildirimler((onceki) => [payload.new as Bildirim, ...onceki].slice(0, 20));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  useEffect(() => {
    function disaTikla(e: MouseEvent) {
      if (kutuRef.current && !kutuRef.current.contains(e.target as Node)) setAcik(false);
    }
    document.addEventListener("mousedown", disaTikla);
    return () => document.removeEventListener("mousedown", disaTikla);
  }, []);

  async function okunduIsaretle(id: string) {
    setBildirimler((onceki) => onceki.map((b) => (b.id === id ? { ...b, okundu: true } : b)));
    const supabase = createClient();
    await supabase.from("bildirimler").update({ okundu: true }).eq("id", id);
  }

  async function tumunuOkunduIsaretle() {
    const okunmamislar = bildirimler.filter((b) => !b.okundu).map((b) => b.id);
    if (okunmamislar.length === 0) return;
    setBildirimler((onceki) => onceki.map((b) => ({ ...b, okundu: true })));
    const supabase = createClient();
    await supabase.from("bildirimler").update({ okundu: true }).in("id", okunmamislar);
  }

  async function bildirimeTikla(b: Bildirim) {
    if (!b.okundu) await okunduIsaretle(b.id);
    setAcik(false);
    if (b.link) router.push(b.link);
  }

  return (
    <div className="relative" ref={kutuRef}>
      <button
        onClick={() => setAcik((v) => !v)}
        className="relative p-2 rounded-lg text-gray-500 hover:text-blue-700 hover:bg-gray-50 transition-colors"
        aria-label="Bildirimler"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {okunmamisSayisi > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
            {okunmamisSayisi > 9 ? "9+" : okunmamisSayisi}
          </span>
        )}
      </button>

      {acik && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl border border-gray-200 shadow-lg z-50 max-h-[28rem] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900">Bildirimler</p>
            <div className="flex items-center gap-3">
              {okunmamisSayisi > 0 && (
                <button onClick={tumunuOkunduIsaretle} className="text-xs text-blue-600 hover:underline font-medium">
                  Tümünü okundu işaretle
                </button>
              )}
              <Link href="/panel/bildirim-ayarlari" onClick={() => setAcik(false)} className="text-gray-400 hover:text-gray-600" aria-label="Bildirim ayarları">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </Link>
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            {yukleniyor ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3].map((n) => <div key={n} className="h-12 bg-gray-50 rounded-lg animate-pulse" />)}
              </div>
            ) : bildirimler.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Henüz bildiriminiz yok.</p>
            ) : (
              bildirimler.map((b) => (
                <button
                  key={b.id}
                  onClick={() => bildirimeTikla(b)}
                  className={`w-full text-left flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors ${!b.okundu ? "bg-blue-50/40" : ""}`}
                >
                  <span className="text-lg flex-shrink-0 mt-0.5">{TUR_IKON[b.tur] ?? "🔔"}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!b.okundu ? "font-semibold text-gray-900" : "font-medium text-gray-700"}`}>{b.baslik}</p>
                    <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{b.mesaj}</p>
                    <p className="text-[11px] text-gray-400 mt-1">{goreliZaman(b.created_at)}</p>
                  </div>
                  {!b.okundu && <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0 mt-1.5" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
