"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import ArsaSahibiPanel from "../ArsaSahibiPanel";

// İhale yayınlandıktan sonra ihale-olustur sayfası buraya otomatik
// yönlendirir (?yayin=basarili) -- kullanıcı burada beklemeden, ekstra
// bir "Tamam" tıklaması olmadan başarı mesajını görür.
function YayinBasariBildirimi() {
  const searchParams = useSearchParams();
  const [goster, setGoster] = useState(() => searchParams.get("yayin") === "basarili");

  useEffect(() => {
    if (!goster) return;
    const t = setTimeout(() => setGoster(false), 8000);
    return () => clearTimeout(t);
  }, [goster]);

  if (!goster) return null;

  return (
    <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 mb-6 flex items-center gap-4">
      <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-green-800">
          İhaleniz başarıyla yayınlandı ve admin onayına gönderildi.
        </p>
        <p className="text-xs text-green-700 mt-0.5">İnceleme süreci tamamlandığında bildirim alacaksınız.</p>
      </div>
      <button
        onClick={() => setGoster(false)}
        className="text-green-500 hover:text-green-700 p-1 rounded-lg hover:bg-green-100 transition-colors flex-shrink-0"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default function PanelIhalelerim() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { router.replace("/giris?next=" + encodeURIComponent("/panel/ihalelerim")); return; }
      setUserId(session.user.id);
      setYukleniyor(false);
    });
  }, [router]);

  if (yukleniyor || !userId) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="h-8 bg-gray-200 rounded w-48 mb-8 animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-white border border-gray-200 rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">İhalelerim</h1>
          <Link href="/panel" className="text-xs text-blue-600 hover:underline font-medium">
            ← Panelime Dön
          </Link>
        </div>
        <Link
          href="/ihale-olustur"
          className="flex items-center gap-2 bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-800 transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Yeni İhale
        </Link>
      </div>

      <Suspense fallback={null}>
        <YayinBasariBildirimi />
      </Suspense>

      <ArsaSahibiPanel userId={userId} />
    </div>
  );
}
