"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { mockDanishmanlar } from "@/lib/mock-data";
import type { Danishman } from "@/lib/types";

export default function AdminDanismanlar() {
  const [liste, setListe]         = useState<Danishman[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [siliniyor, setSiliniyor]   = useState<string | null>(null);
  const [hata, setHata]             = useState("");

  async function yukle() {
    setYukleniyor(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("danismanlar")
      .select("*")
      .order("created_at", { ascending: false });
    if (error || !data) {
      setListe(mockDanishmanlar);
    } else {
      setListe(data.length > 0 ? (data as Danishman[]) : mockDanishmanlar);
    }
    setYukleniyor(false);
  }

  useEffect(() => { yukle(); }, []);

  async function handleSil(id: string) {
    if (!confirm("Bu destek uzmanını silmek istediğinizden emin misiniz?")) return;
    setSiliniyor(id);
    const supabase = createClient();
    const { error } = await supabase.from("danismanlar").delete().eq("id", id);
    if (error) {
      setHata("Silme işlemi başarısız: " + error.message);
    } else {
      await yukle();
    }
    setSiliniyor(null);
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Destek Uzmanları</h1>
          <p className="text-gray-500 text-sm mt-1">{liste.length} destek uzmanı kayıtlı</p>
        </div>
        <Link
          href="/admin/danismanlar/yeni"
          className="flex items-center gap-2 bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Yeni Destek Uzmanı Ekle
        </Link>
      </div>

      {hata && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-6">
          {hata}
        </div>
      )}

      {yukleniyor ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-white rounded-xl border border-gray-200 animate-pulse" />
          ))}
        </div>
      ) : liste.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg font-medium mb-2">Henüz destek uzmanı yok</p>
          <Link href="/admin/danismanlar/yeni" className="text-blue-600 hover:underline text-sm">
            İlk destek uzmanını ekleyin →
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-6 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Ad Soyad</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide hidden md:table-cell">Uzmanlık</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide hidden lg:table-cell">Çalıştığı İller</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Deneyim</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {liste.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-semibold text-gray-900">{d.ad_soyad}</p>
                      <p className="text-xs text-gray-400">{d.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {d.uzmanlik_alanlari.slice(0, 2).map((u) => (
                        <span key={u} className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full">{u}</span>
                      ))}
                      {d.uzmanlik_alanlari.length > 2 && (
                        <span className="text-xs text-gray-400">+{d.uzmanlik_alanlari.length - 2}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 hidden lg:table-cell">
                    <p className="text-gray-600 text-xs">
                      {(d.calistigi_iller ?? []).slice(0, 3).join(", ")}
                      {(d.calistigi_iller ?? []).length > 3 && ` +${(d.calistigi_iller ?? []).length - 3}`}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-700 font-medium">{d.deneyim_yili} yıl</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/danismanlar/${d.id}`}
                        target="_blank"
                        className="text-blue-600 hover:underline text-xs"
                      >
                        Görüntüle
                      </Link>
                      <button
                        onClick={() => handleSil(d.id)}
                        disabled={siliniyor === d.id}
                        className="text-red-500 hover:text-red-700 text-xs disabled:opacity-40"
                      >
                        {siliniyor === d.id ? "Siliniyor…" : "Sil"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
