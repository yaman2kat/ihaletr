"use client";

import { useState } from "react";

interface Props {
  sehir: string;
  ilce?: string;
  adaNo?: string;
  parselNo?: string;
}

const MAP_PATH = "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7";

export default function AdaParselButon({ sehir, ilce, adaNo, parselNo }: Props) {
  const [gosterBildirim, setGosterBildirim] = useState(false);
  const aktif = !!(adaNo && parselNo);

  async function handleClick() {
    if (!aktif) return;

    const satirlar = [
      `İl: ${sehir}`,
      ilce     ? `İlçe: ${ilce}`         : null,
      adaNo    ? `Ada No: ${adaNo}`       : null,
      parselNo ? `Parsel No: ${parselNo}` : null,
    ].filter(Boolean) as string[];

    try {
      await navigator.clipboard.writeText(satirlar.join("\n"));
    } catch {
      // Clipboard API desteklenmiyorsa sessizce devam et
    }

    window.open("https://parselsorgu.tkgm.gov.tr/", "_blank", "noopener,noreferrer");

    setGosterBildirim(true);
    setTimeout(() => setGosterBildirim(false), 5000);
  }

  return (
    <>
      {/* Üst bildirim bandı */}
      {gosterBildirim && (
        <div className="fixed top-16 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-3 bg-green-600 text-white text-sm px-5 py-3 rounded-xl shadow-lg max-w-lg w-full">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <span className="flex-1">
              Ada-parsel bilgileri panoya kopyalandı, TKGM sayfasına yapıştırın.
            </span>
            <button
              onClick={() => setGosterBildirim(false)}
              className="flex-shrink-0 hover:text-green-200 transition-colors"
              aria-label="Kapat"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {aktif ? (
        <button
          type="button"
          onClick={handleClick}
          className="w-full flex items-center justify-center gap-2 bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl hover:bg-blue-800 active:bg-blue-900 transition-colors text-sm shadow-sm"
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={MAP_PATH} />
          </svg>
          Ada-Parsel Sorgula (TKGM)
          <svg className="w-3.5 h-3.5 flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </button>
      ) : (
        <div className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 text-gray-400 py-3 px-4 rounded-xl text-sm bg-gray-50 cursor-default select-none">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={MAP_PATH} />
          </svg>
          Ada-parsel bilgisi eklenmemiş
        </div>
      )}
    </>
  );
}
