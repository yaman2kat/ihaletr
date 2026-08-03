"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Ihale, IncelemeDurumu } from "@/lib/types";

const INCELEME_BADGE: Record<IncelemeDurumu, { etiket: string; cls: string }> = {
  beklemede:  { etiket: "İnceleniyor", cls: "bg-gray-100 text-gray-600" },
  onaylandi:  { etiket: "Onaylı",      cls: "bg-green-100 text-green-700" },
  reddedildi: { etiket: "Reddedildi",  cls: "bg-red-100 text-red-600" },
};

const MULKIYET_ETIKET: Record<string, string> = {
  tek_malik: "Tek Malik",
  hisseli:   "Hisseli",
  vekaleten: "Vekaleten",
  sirket:    "Şirket",
};

type Filtre = "beklemede" | "onaylandi" | "reddedildi" | "tumu";

function tarihFormat(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

export default function AdminIhaleler() {
  const [ihaleler,  setIhaleler]  = useState<Ihale[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [yetkisiz,  setYetkisiz]  = useState(false);
  const [filtre,    setFiltre]    = useState<Filtre>("beklemede");

  useEffect(() => {
    async function yukle() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setYetkisiz(true); setYukleniyor(false); return; }

      const { data: profil } = await supabase
        .from("kullanicilar")
        .select("rol")
        .eq("id", session.user.id)
        .single();
      if (profil?.rol !== "admin") { setYetkisiz(true); setYukleniyor(false); return; }

      const { data } = await supabase
        .from("ihaleler")
        .select("*")
        .order("created_at", { ascending: false });
      setIhaleler((data ?? []) as Ihale[]);
      setYukleniyor(false);
    }
    yukle();
  }, []);

  const filtreliListe = ihaleler.filter((i) => filtre === "tumu" || (i.inceleme_durumu ?? "beklemede") === filtre);

  if (yetkisiz) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center">
        <p className="text-gray-600">Bu sayfayı görüntülemek için admin yetkisi gereklidir.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">İhaleler — Mülkiyet İncelemesi</h1>
        <p className="text-gray-500 text-sm mt-1">
          Taşınmaz mülkiyet belgelerini inceleyip ihaleleri onaylayın ya da reddedin.
        </p>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
        {([
          ["beklemede", "İnceleniyor"],
          ["onaylandi", "Onaylı"],
          ["reddedildi", "Reddedildi"],
          ["tumu", "Tümü"],
        ] as [Filtre, string][]).map(([k, e]) => (
          <button key={k} onClick={() => setFiltre(k)}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              filtre === k ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}>
            {e}
          </button>
        ))}
      </div>

      {yukleniyor ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-white rounded-xl border border-gray-200 animate-pulse" />
          ))}
        </div>
      ) : filtreliListe.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg font-medium">Bu filtrede ihale yok</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-6 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Başlık</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Başvuru Sahibi</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide hidden md:table-cell">Mülkiyet Durumu</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide hidden lg:table-cell">Tarih</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">İnceleme</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtreliListe.map((ihale) => {
                const durum = ihale.inceleme_durumu ?? "beklemede";
                return (
                  <tr key={ihale.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-900 line-clamp-1">{ihale.baslik}</p>
                      <p className="text-xs text-gray-400">{ihale.kurum}</p>
                    </td>
                    <td className="px-6 py-4 text-gray-700">{ihale.basvuru_sahibi_adi ?? "—"}</td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      {ihale.mulkiyet_durumu ? (
                        <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">
                          {MULKIYET_ETIKET[ihale.mulkiyet_durumu] ?? ihale.mulkiyet_durumu}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell text-gray-500 text-xs">{tarihFormat(ihale.created_at)}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${INCELEME_BADGE[durum].cls}`}>
                        {INCELEME_BADGE[durum].etiket}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Link href={`/admin/ihaleler/${ihale.id}`} className="text-blue-600 hover:underline text-xs font-medium">
                        İncele →
                      </Link>
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
