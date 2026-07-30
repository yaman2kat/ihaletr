"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMuteahhitlerClient } from "@/lib/muteahhitler";
import type { MuteahhitProfil, InsaatTuru } from "@/lib/types";

const TUR_RENK: Record<InsaatTuru, string> = {
  "Kentsel Dönüşüm": "bg-purple-100 text-purple-700",
  "Kat Karşılığı":   "bg-blue-100 text-blue-700",
  "Yapı İnşaat":     "bg-green-100 text-green-700",
  "Bakım & Onarım":  "bg-orange-100 text-orange-700",
};

function MuteahhitKarti({ m }: { m: MuteahhitProfil }) {
  return (
    <Link
      href={`/muteahhit/${m.kullanici_id}`}
      className="group flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all p-6"
    >
      <div className="flex items-start gap-4 mb-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center flex-shrink-0 shadow-sm">
          {m.foto_url ? (
            <img src={m.foto_url} alt={m.firma_adi} className="w-14 h-14 rounded-2xl object-cover" />
          ) : (
            <span className="text-xl font-bold text-white">{m.firma_adi.charAt(0)}</span>
          )}
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-gray-900 text-base leading-snug group-hover:text-blue-700 transition-colors truncate">
            {m.firma_adi}
          </h3>
          {m.kurulus_yili && (
            <p className="text-xs text-gray-400 mt-0.5">Kuruluş: {m.kurulus_yili}</p>
          )}
          {m.yetki_belgesi_grubu && (
            <span className="inline-block text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full mt-1.5">
              {m.yetki_belgesi_grubu === "Geçici/Y Belgesi" ? m.yetki_belgesi_grubu : `${m.yetki_belgesi_grubu} Grubu`}
            </span>
          )}
        </div>
      </div>

      {m.uzmanlik_alanlari.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {m.uzmanlik_alanlari.slice(0, 3).map((u) => (
            <span key={u} className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${TUR_RENK[u]}`}>
              {u}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center mt-auto pt-4 border-t border-gray-100">
        <div>
          <p className="text-sm font-bold text-blue-700">{m.tamamlanan_proje_sayisi}</p>
          <p className="text-[10px] text-gray-400 leading-tight">Tamamlanan</p>
        </div>
        <div>
          <p className="text-sm font-bold text-green-700">{m.kazanilan_ihale_sayisi}</p>
          <p className="text-[10px] text-gray-400 leading-tight">Kazanılan</p>
        </div>
        <div>
          <p className="text-sm font-bold text-orange-600">{m.aktif_ihale_sayisi}</p>
          <p className="text-[10px] text-gray-400 leading-tight">Aktif</p>
        </div>
      </div>
    </Link>
  );
}

export default function MuteahhitlerSayfasi() {
  const [muteahhitler, setMuteahhitler] = useState<MuteahhitProfil[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [arama, setArama] = useState("");

  useEffect(() => {
    getMuteahhitlerClient().then((data) => {
      setMuteahhitler(data);
      setYukleniyor(false);
    });
  }, []);

  const filtrelenmis = muteahhitler.filter((m) =>
    m.firma_adi.toLocaleLowerCase("tr").includes(arama.trim().toLocaleLowerCase("tr"))
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-blue-700">Ana Sayfa</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Müteahhitler</span>
      </nav>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Müteahhitler</h1>
        <p className="text-gray-500 text-sm">Platformdaki tüm müteahhit firmaları keşfedin ve profillerini inceleyin.</p>
      </div>

      {/* Arama */}
      <div className="relative mb-8 max-w-md">
        <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 10.5A6.5 6.5 0 114 10.5a6.5 6.5 0 0113 0z" />
        </svg>
        <input
          type="text"
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          placeholder="Firma adına göre ara..."
          className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {yukleniyor ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 bg-white border border-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtrelenmis.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-2xl mb-3">🔍</p>
          <p className="text-gray-600 font-medium mb-1">Eşleşen müteahhit bulunamadı</p>
          <p className="text-gray-400 text-sm">Farklı bir firma adı deneyin</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtrelenmis.map((m) => (
            <MuteahhitKarti key={m.kullanici_id} m={m} />
          ))}
        </div>
      )}
    </div>
  );
}
