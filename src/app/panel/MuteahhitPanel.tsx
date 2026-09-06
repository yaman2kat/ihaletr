"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { IhaleDurumu, MuteahhitProfil } from "@/lib/types";
import { tarihFormat, paraBirim } from "./utils";

interface VerilenTeklif {
  id: string;
  ihale_id: string;
  tutar: number;
  durum: string;
  created_at: string;
  ihale?: { baslik: string; bitis_tarihi: string; durum: IhaleDurumu };
}

interface MuteahhitPanelProps {
  userId: string;
}

export default function MuteahhitPanel({ userId }: MuteahhitPanelProps) {
  const [teklifler,  setTeklifler]  = useState<VerilenTeklif[]>([]);
  const [kalanHak,   setKalanHak]   = useState<number | null>(null);
  const [profil,     setProfil]     = useState<MuteahhitProfil | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function yukle() {
      const [teklifRes, profilRes, muteahhitRes] = await Promise.all([
        supabase.from("teklifler")
          .select("*, ihale:ihaleler(baslik, bitis_tarihi, durum)")
          .eq("kullanici_id", userId)
          .order("created_at", { ascending: false }),
        supabase.from("kullanicilar").select("kalan_teklif_hakki").eq("id", userId).single(),
        supabase.from("muteahhit_profiller").select("*").eq("kullanici_id", userId).single(),
      ]);

      setTeklifler((teklifRes.data ?? []) as VerilenTeklif[]);
      setKalanHak(profilRes.data?.kalan_teklif_hakki ?? 1);
      setProfil((muteahhitRes.data as MuteahhitProfil) ?? null);
      setYukleniyor(false);
    }
    yukle();
  }, [userId]);

  if (yukleniyor) {
    return (
      <div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-white border border-gray-200 rounded-2xl animate-pulse" />)}
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-white border border-gray-200 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ─── İstatistik Kartları ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="w-9 h-9 rounded-xl mb-3 flex items-center justify-center bg-purple-50">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
          </div>
          <p className="text-2xl font-bold text-purple-700">{teklifler.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Verilen Teklif</p>
        </div>

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

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="w-9 h-9 rounded-xl mb-3 flex items-center justify-center bg-green-50">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-2xl font-bold text-green-700">{profil?.kazanilan_ihale_sayisi ?? 0}</p>
          <p className="text-xs text-gray-500 mt-0.5">Kazanılan İhale</p>
        </div>
      </div>

      {/* ─── Müteahhit Profili ─── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-8">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-gray-900">Müteahhit Profili</h2>
          {profil && (
            <div className="flex items-center gap-3">
              <Link href={`/muteahhit/${userId}`} className="text-xs text-blue-600 hover:underline font-medium">
                Görüntüle
              </Link>
              <Link href={`/muteahhit/${userId}/duzenle`} className="text-xs text-blue-600 hover:underline font-medium">
                Düzenle
              </Link>
            </div>
          )}
        </div>

        {profil ? (
          <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-sm text-gray-600">
            <span><span className="text-gray-400">Firma:</span> <span className="font-medium text-gray-900">{profil.firma_adi}</span></span>
            {profil.yetki_belgesi_grubu && (
              <span><span className="text-gray-400">Yetki Belgesi:</span> <span className="font-medium text-gray-900">{profil.yetki_belgesi_grubu}</span></span>
            )}
            <span><span className="text-gray-400">Tamamlanan Proje:</span> <span className="font-medium text-gray-900">{profil.tamamlanan_proje_sayisi}</span></span>
            <span><span className="text-gray-400">Aktif İhale:</span> <span className="font-medium text-gray-900">{profil.aktif_ihale_sayisi}</span></span>
          </div>
        ) : (
          <p className="text-sm text-gray-500 mt-2">
            Müteahhit profiliniz henüz oluşturulmadı. Profiliniz oluşturulduğunda burada görünecek.
          </p>
        )}
      </div>

      {/* ─── Verilen Teklifler ─── */}
      <h2 className="text-lg font-bold text-gray-900 mb-4">Verilen Teklifler</h2>
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
  );
}
