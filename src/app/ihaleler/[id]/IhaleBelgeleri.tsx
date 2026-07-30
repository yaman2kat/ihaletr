"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Belge {
  id: string;
  baslik: string;
  dosya_url: string;
  tur: string;
}

export default function IhaleBelgeleri({ ihaleId }: { ihaleId: string }) {
  const [belgeler, setBelgeler] = useState<Belge[]>([]);
  const [yuklendi, setYuklendi] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("belgeler")
      .select("id, baslik, dosya_url, tur")
      .eq("ihale_id", ihaleId)
      .then(({ data }) => {
        // RLS zaten tapu belgesini bu sorgudan hariç tutar; burada tekrar
        // filtrelemek ek bir güvenlik katmanı sağlar.
        setBelgeler((data ?? []).filter((b) => b.tur !== "tapu"));
        setYuklendi(true);
      });
  }, [ihaleId]);

  if (!yuklendi || belgeler.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Belgeler
      </h2>
      <div className="flex flex-col gap-2">
        {belgeler.map((b) => (
          <a
            key={b.id}
            href={b.dosya_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-blue-700 hover:underline"
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {b.baslik}
          </a>
        ))}
      </div>
    </div>
  );
}
