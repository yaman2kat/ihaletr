"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { HesapTuru } from "@/lib/types";
import DavetKart from "./DavetKart";
import ArsaSahibiPanel from "./ArsaSahibiPanel";
import MuteahhitPanel from "./MuteahhitPanel";

// ─── Ödeme başarı bildirimi (useSearchParams Suspense gerektirir) ─────────────

function OdemeBildirimi() {
  const searchParams = useSearchParams();
  const [goster, setGoster] = useState(() => searchParams.get("odeme") === "basarili");

  useEffect(() => {
    if (!goster) return;
    const t = setTimeout(() => setGoster(false), 6000);
    return () => clearTimeout(t);
  }, [goster]);

  if (!goster) return null;

  return (
    <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 mb-5 flex items-center gap-4">
      <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-green-800">Ödeme başarıyla tamamlandı!</p>
        <p className="text-xs text-green-700 mt-0.5">Paketiniz hesabınıza tanımlandı, anında kullanıma hazır.</p>
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

// ─── Ana bileşen ─────────────────────────────────────────────────────────────

type HerIkisiSekme = "arsa_sahibi" | "muteahhit";

export default function PanelSayfasi() {
  const router      = useRouter();
  const [kullanici,  setKullanici]  = useState<User | null | undefined>(undefined);
  const [hesapTuru,  setHesapTuru]  = useState<HesapTuru>("arsa_sahibi");
  const [yukleniyor, setYukleniyor] = useState(true);
  const [herIkisiSekme, setHerIkisiSekme] = useState<HerIkisiSekme>("arsa_sahibi");
  const [yenilemeSayaci, setYenilemeSayaci] = useState(0);

  const supabase = createClient();

  useEffect(() => {
    async function yukle() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.replace("/giris"); return; }
      setKullanici(session.user);

      const { data } = await supabase.from("kullanicilar").select("hesap_turu").eq("id", session.user.id).single();
      setHesapTuru((data?.hesap_turu as HesapTuru) ?? "arsa_sahibi");

      setYukleniyor(false);
    }
    yukle();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace("/giris");
      else setKullanici(session.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (kullanici === undefined || yukleniyor) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="h-8 bg-gray-200 rounded w-48 mb-8 animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-white border border-gray-200 rounded-2xl animate-pulse" />)}
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-white border border-gray-200 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  const gorunenPanel = hesapTuru === "her_ikisi" ? herIkisiSekme : hesapTuru;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

      {/* ─── Başlık ─── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Panelim</h1>
          <p className="text-gray-500 text-sm mt-0.5">{kullanici?.email}</p>
        </div>
        {gorunenPanel === "arsa_sahibi" && (
          <Link
            href="/ihale-olustur"
            className="flex items-center gap-2 bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-800 transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Yeni İhale
          </Link>
        )}
      </div>

      {/* ─── Ödeme Başarı Bildirimi ─── */}
      <Suspense fallback={null}>
        <OdemeBildirimi />
      </Suspense>

      {/* ─── Arkadaşını Davet Et ─── */}
      <DavetKart userId={kullanici!.id} onOduluUygulandi={() => setYenilemeSayaci((n) => n + 1)} />

      {/* ─── Her İkisi: panel geçiş sekmeleri ─── */}
      {hesapTuru === "her_ikisi" && (
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
          {([["arsa_sahibi", "Arsa Sahibi Paneli"], ["muteahhit", "Müteahhit Paneli"]] as [HerIkisiSekme, string][]).map(([k, e]) => (
            <button key={k} onClick={() => setHerIkisiSekme(k)}
              className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all ${
                herIkisiSekme === k ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}>
              {e}
            </button>
          ))}
        </div>
      )}

      {gorunenPanel === "arsa_sahibi" ? (
        <ArsaSahibiPanel key={`arsa-${yenilemeSayaci}`} userId={kullanici!.id} />
      ) : (
        <MuteahhitPanel key={`muteahhit-${yenilemeSayaci}`} userId={kullanici!.id} />
      )}
    </div>
  );
}
