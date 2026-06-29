"use client";

import { useState, useEffect } from "react";

interface Props {
  bitisTarihi: string;
}

interface Sure {
  gun: number;
  saat: number;
  dakika: number;
  saniye: number;
  bitti: boolean;
}

function hesapla(bitisTarihi: string): Sure {
  const kalan = new Date(bitisTarihi).getTime() - Date.now();
  if (kalan <= 0) return { gun: 0, saat: 0, dakika: 0, saniye: 0, bitti: true };
  return {
    gun:     Math.floor(kalan / (1000 * 60 * 60 * 24)),
    saat:    Math.floor((kalan % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    dakika:  Math.floor((kalan % (1000 * 60 * 60)) / (1000 * 60)),
    saniye:  Math.floor((kalan % (1000 * 60)) / 1000),
    bitti: false,
  };
}

const birimler = [
  { key: "gun",    etiket: "Gün"  },
  { key: "saat",   etiket: "Saat" },
  { key: "dakika", etiket: "Dak"  },
  { key: "saniye", etiket: "Sn"   },
] as const;

export default function GeriSayim({ bitisTarihi }: Props) {
  const [sure, setSure] = useState<Sure>(() => hesapla(bitisTarihi));

  useEffect(() => {
    const interval = setInterval(() => setSure(hesapla(bitisTarihi)), 1000);
    return () => clearInterval(interval);
  }, [bitisTarihi]);

  if (sure.bitti) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
        <p className="text-sm text-red-600 font-medium">İhale Süresi Doldu</p>
      </div>
    );
  }

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
      <p className="text-xs text-orange-600 text-center font-semibold uppercase tracking-wide mb-3">
        Kalan Süre
      </p>
      <div className="grid grid-cols-4 gap-1.5">
        {birimler.map(({ key, etiket }) => (
          <div key={key} className="bg-white border border-orange-100 rounded-lg py-2 text-center">
            <p className="text-2xl font-bold text-orange-700 tabular-nums leading-none">
              {String(sure[key]).padStart(2, "0")}
            </p>
            <p className="text-[10px] text-orange-400 mt-1 font-medium">{etiket}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
