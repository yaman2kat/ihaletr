"use client";

import { useRef, useState } from "react";

interface Props {
  label: string;
  kabul: string;        // ".pdf" | ".pdf,.dwg" | ".pdf,.jpg,.jpeg"
  zorunlu?: boolean;
  dosya: File | null;
  onChange: (dosya: File | null) => void;
}

function formatBoyut(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function uzantiEtiket(kabul: string): string {
  return kabul
    .split(",")
    .map((k) => k.trim().replace(".", "").toUpperCase())
    .join(", ");
}

function dosyaGecerli(dosya: File, kabul: string): boolean {
  const uzanti = "." + dosya.name.split(".").pop()?.toLowerCase();
  return kabul.split(",").map((k) => k.trim().toLowerCase()).includes(uzanti);
}

export default function DosyaAlani({ label, kabul, zorunlu = false, dosya, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [surukleniyor, setSurukleniyor] = useState(false);
  const [hata, setHata] = useState("");

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setSurukleniyor(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (!dosyaGecerli(file, kabul)) {
      setHata(`Desteklenen formatlar: ${uzantiEtiket(kabul)}`);
      return;
    }
    setHata("");
    onChange(file);
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setHata("");
    onChange(file);
    // Input'u sıfırla ki aynı dosya tekrar seçilebilsin
    e.target.value = "";
  }

  function kaldir() {
    onChange(null);
    setHata("");
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}{" "}
        {zorunlu
          ? <span className="text-red-500">*</span>
          : <span className="text-gray-400 font-normal">(İsteğe Bağlı)</span>
        }
      </label>

      {dosya ? (
        /* Dosya seçilmiş — bilgi göster */
        <div className="flex items-center gap-3 border border-green-200 bg-green-50 rounded-xl px-4 py-3">
          <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{dosya.name}</p>
            <p className="text-xs text-gray-500">{formatBoyut(dosya.size)}</p>
          </div>
          <button
            type="button"
            onClick={kaldir}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-red-100 hover:text-red-600 transition-colors"
            aria-label="Dosyayı kaldır"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        /* Sürükle-bırak alanı */
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setSurukleniyor(true); }}
          onDragLeave={() => setSurukleniyor(false)}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-xl px-6 py-5 text-center cursor-pointer transition-all select-none ${
            surukleniyor
              ? "border-blue-400 bg-blue-50"
              : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
          }`}
        >
          <div className="flex flex-col items-center gap-2">
            <svg className={`w-8 h-8 ${surukleniyor ? "text-blue-500" : "text-gray-300"}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <p className="text-sm text-gray-600">
              <span className="font-medium text-blue-600">Dosya seçin</span>
              {" "}veya buraya sürükleyin
            </p>
            <p className="text-xs text-gray-400">{uzantiEtiket(kabul)}</p>
          </div>
        </div>
      )}

      {hata && <p className="text-xs text-red-600 mt-1">{hata}</p>}

      <input
        ref={inputRef}
        type="file"
        accept={kabul}
        onChange={handleInput}
        className="hidden"
      />
    </div>
  );
}
