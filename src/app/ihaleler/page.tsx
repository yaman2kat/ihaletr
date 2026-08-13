"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import IhaleKarti from "@/components/IhaleKarti";
import { mockIhaleler } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";
import { IhaleDurumu, type Ihale } from "@/lib/types";

const KATEGORILER = [
  "Tümü",
  "Kentsel Dönüşüm",
  "Kat Karşılığı",
  "Yapı İnşaat",
  "Bakım & Onarım",
];

const DURUMLAR: { deger: string; etiket: string }[] = [
  { deger: "tumu",       etiket: "Tümü"        },
  { deger: "aktif",      etiket: "Aktif"        },
  { deger: "beklemede",  etiket: "Beklemede"    },
  { deger: "tamamlandi", etiket: "Tamamlandı"   },
];

function IhalelerIcerik() {
  const searchParams = useSearchParams();
  const urlKategori = searchParams.get("kategori") ?? "";
  const baslangicKategori = KATEGORILER.includes(urlKategori) ? urlKategori : "Tümü";

  const [arama,           setArama]           = useState("");
  const [secilenKategori, setSecilenKategori] = useState(baslangicKategori);
  const [secilenDurum,    setSecilenDurum]    = useState("tumu");
  const [siralama,        setSiralama]        = useState("yeni");
  const [dbIhaleler,      setDbIhaleler]      = useState<Ihale[]>([]);

  // Genel listede yalnizca admin incelemesinden gecmis (onaylandi) gercek
  // ihaleler gorunur -- beklemede/reddedildi olanlar RLS tarafindan zaten
  // bu sorgudan hariç tutulur, burada ayrica filtrelemek ek bir guvenlik
  // katmani saglar (bkz. ihale_gorunurluk_migration.sql).
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("ihaleler")
      .select("*")
      .eq("inceleme_durumu", "onaylandi")
      .order("created_at", { ascending: false })
      .then(({ data }) => setDbIhaleler((data ?? []) as Ihale[]));
  }, []);

  const filtreliIhaleler = useMemo(() => {
    let sonuc = [...dbIhaleler, ...mockIhaleler];

    if (arama.trim()) {
      const k = arama.toLowerCase();
      sonuc = sonuc.filter(
        (i) =>
          i.baslik.toLowerCase().includes(k) ||
          i.kurum.toLowerCase().includes(k) ||
          i.sehir.toLowerCase().includes(k)
      );
    }

    if (secilenKategori !== "Tümü") {
      sonuc = sonuc.filter((i) => i.kategori === secilenKategori);
    }

    if (secilenDurum !== "tumu") {
      sonuc = sonuc.filter((i) => i.durum === (secilenDurum as IhaleDurumu));
    }

    if (siralama === "yeni") {
      sonuc.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (siralama === "bitis") {
      sonuc.sort((a, b) => new Date(a.bitis_tarihi).getTime() - new Date(b.bitis_tarihi).getTime());
    } else if (siralama === "fiyat-artan") {
      sonuc.sort((a, b) => a.baslangic_fiyati - b.baslangic_fiyati);
    } else if (siralama === "fiyat-azalan") {
      sonuc.sort((a, b) => b.baslangic_fiyati - a.baslangic_fiyati);
    }

    return sonuc;
  }, [dbIhaleler, arama, secilenKategori, secilenDurum, siralama]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">İhaleler</h1>
        <p className="text-gray-500">{filtreliIhaleler.length} ihale listeleniyor</p>
      </div>

      {/* Arama + Sıralama */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="İhale, kurum veya şehir ara..."
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
            />
          </div>
          <select
            value={siralama}
            onChange={(e) => setSiralama(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="yeni">En Yeni</option>
            <option value="bitis">Bitiş Tarihi</option>
            <option value="fiyat-artan">Fiyat (Artan)</option>
            <option value="fiyat-azalan">Fiyat (Azalan)</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Filtre Paneli */}
        <aside className="lg:w-56 shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm sticky top-20">
            <h3 className="font-semibold text-gray-900 mb-3">Durum</h3>
            <div className="flex flex-col gap-1 mb-6">
              {DURUMLAR.map((d) => (
                <button
                  key={d.deger}
                  onClick={() => setSecilenDurum(d.deger)}
                  className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    secilenDurum === d.deger
                      ? "bg-blue-100 text-blue-700"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {d.etiket}
                </button>
              ))}
            </div>

            <h3 className="font-semibold text-gray-900 mb-3">Kategori</h3>
            <div className="flex flex-col gap-1">
              {KATEGORILER.map((k) => (
                <button
                  key={k}
                  onClick={() => setSecilenKategori(k)}
                  className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    secilenKategori === k
                      ? "bg-blue-100 text-blue-700"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>

            {(secilenKategori !== "Tümü" || secilenDurum !== "tumu") && (
              <button
                onClick={() => { setSecilenKategori("Tümü"); setSecilenDurum("tumu"); }}
                className="mt-4 w-full text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Filtreleri Temizle
              </button>
            )}
          </div>
        </aside>

        {/* Sonuçlar */}
        <div className="flex-1">
          {filtreliIhaleler.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-16 text-center shadow-sm">
              <p className="text-gray-400 text-lg mb-2">Sonuç bulunamadı</p>
              <p className="text-gray-400 text-sm">Farklı filtreler deneyin</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filtreliIhaleler.map((ihale) => (
                <IhaleKarti key={ihale.id} ihale={ihale} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function IhalelerSayfasi() {
  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="h-8 bg-gray-100 rounded w-48 mb-8 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="bg-gray-100 rounded-xl h-64 animate-pulse" />
          ))}
        </div>
      </div>
    }>
      <IhalelerIcerik />
    </Suspense>
  );
}
