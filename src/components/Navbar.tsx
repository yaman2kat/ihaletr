"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { HesapTuru } from "@/lib/types";
import BildirimZili from "./BildirimZili";

const PLAN_BADGE: Record<string, { etiket: string; cls: string }> = {
  ucretsiz: { etiket: "Ücretsiz", cls: "bg-gray-100 text-gray-500" },
  premium:  { etiket: "Premium",  cls: "bg-blue-100 text-blue-700" },
  kurumsal: { etiket: "Kurumsal", cls: "bg-purple-100 text-purple-700" },
};

export default function Navbar() {
  const router = useRouter();
  const [menuAcik,   setMenuAcik]   = useState(false);
  const [kullanici,  setKullanici]  = useState<User | null | undefined>(undefined);
  const [planTuru,   setPlanTuru]   = useState<string | null>(null);
  const [kalanHak,   setKalanHak]   = useState<number | null>(null);
  const [hesapTuru,  setHesapTuru]  = useState<HesapTuru | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function profilGetir(userId: string) {
      const { data } = await supabase
        .from("kullanicilar")
        .select("plan_turu, kalan_teklif_hakki, hesap_turu")
        .eq("id", userId)
        .single();
      setPlanTuru(data?.plan_turu ?? "ucretsiz");
      setKalanHak(data?.kalan_teklif_hakki ?? 0);
      setHesapTuru((data?.hesap_turu as HesapTuru) ?? "arsa_sahibi");
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setKullanici(session?.user ?? null);
      if (session?.user) profilGetir(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setKullanici(session?.user ?? null);
        if (session?.user) profilGetir(session.user.id);
        else { setPlanTuru(null); setKalanHak(null); setHesapTuru(null); }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function cikisYap() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setMenuAcik(false);
    router.push("/");
    router.refresh();
  }

  const adSoyad =
    kullanici?.user_metadata?.ad_soyad ||
    kullanici?.email?.split("@")[0] ||
    "Hesabım";

  // Henüz session kontrol edilmedi — auth alanını boş bırak (flash önleme)
  const authYukleniyor = kullanici === undefined;

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-bold text-blue-700">İhale</span>
            <span className="text-2xl font-bold text-gray-800">TR</span>
          </Link>

          {/* Masaüstü Nav Linkleri */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/ihaleler"      className="text-gray-600 hover:text-blue-700 font-medium transition-colors">İhaleler</Link>
            <Link href="/ihale-olustur" className="text-gray-600 hover:text-blue-700 font-medium transition-colors">İhale Oluştur</Link>
            <Link href="/muteahhitler"  className="text-gray-600 hover:text-blue-700 font-medium transition-colors">Müteahhitler</Link>
            <Link href="/danismanlar"   className="text-gray-600 hover:text-blue-700 font-medium transition-colors">Destek</Link>
          </div>

          {/* Masaüstü Auth */}
          <div className="hidden md:flex items-center gap-3 min-w-[180px] justify-end">
            {authYukleniyor ? (
              <div className="h-8 w-32 bg-gray-100 rounded-lg animate-pulse" />
            ) : kullanici ? (
              <>
                <div className="flex items-center gap-1.5">
                  <Link
                    href="/panel"
                    className="text-sm text-gray-700 hover:text-blue-700 font-medium px-3 py-2 bg-gray-50 hover:bg-blue-50 rounded-lg transition-colors truncate max-w-[110px]"
                  >
                    {adSoyad}
                  </Link>
                  {planTuru && (hesapTuru === "arsa_sahibi" || hesapTuru === "her_ikisi") && (
                    <Link href="/premium"
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap transition-opacity hover:opacity-80 ${PLAN_BADGE[planTuru]?.cls ?? PLAN_BADGE.ucretsiz.cls}`}>
                      {PLAN_BADGE[planTuru]?.etiket ?? "Ücretsiz"}
                    </Link>
                  )}
                  {kalanHak !== null && (hesapTuru === "muteahhit" || hesapTuru === "her_ikisi") && (
                    <Link href="/teklif-paketi"
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap transition-opacity hover:opacity-80 ${
                        kalanHak >= 99999
                          ? "bg-green-100 text-green-700"
                          : kalanHak === 0
                            ? "bg-red-100 text-red-700"
                            : kalanHak <= 2
                              ? "bg-amber-100 text-amber-700"
                              : "bg-green-100 text-green-700"
                      }`}>
                      {kalanHak >= 99999 ? "∞ hak" : `${kalanHak} hak`}
                    </Link>
                  )}
                </div>
                <BildirimZili userId={kullanici.id} />
                <Link
                  href="/panel"
                  className="text-sm text-blue-700 font-semibold px-4 py-2 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors"
                >
                  Panelim
                </Link>
                <button
                  onClick={cikisYap}
                  className="text-sm text-gray-600 hover:text-red-600 font-medium px-4 py-2 rounded-lg border border-gray-200 hover:border-red-200 transition-colors"
                >
                  Çıkış Yap
                </button>
              </>
            ) : (
              <>
                <Link href="/giris" className="text-gray-700 hover:text-blue-700 font-medium px-4 py-2 rounded-lg transition-colors">
                  Giriş Yap
                </Link>
                <Link href="/kayit" className="bg-blue-700 text-white font-medium px-4 py-2 rounded-lg hover:bg-blue-800 transition-colors">
                  Kayıt Ol
                </Link>
              </>
            )}
          </div>

          {/* Mobil Hamburger */}
          <button
            className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
            onClick={() => setMenuAcik(!menuAcik)}
            aria-label="Menüyü aç/kapat"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuAcik
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              }
            </svg>
          </button>
        </div>

        {/* Mobil Menü */}
        {menuAcik && (
          <div className="md:hidden pb-4 border-t border-gray-100 mt-2 pt-4 flex flex-col gap-3">
            <Link href="/ihaleler"      className="text-gray-700 font-medium py-2" onClick={() => setMenuAcik(false)}>İhaleler</Link>
            <Link href="/ihale-olustur" className="text-gray-700 font-medium py-2" onClick={() => setMenuAcik(false)}>İhale Oluştur</Link>
            <Link href="/muteahhitler"  className="text-gray-700 font-medium py-2" onClick={() => setMenuAcik(false)}>Müteahhitler</Link>
            <Link href="/danismanlar"   className="text-gray-700 font-medium py-2" onClick={() => setMenuAcik(false)}>Destek</Link>
            <Link href="/premium"       className="text-gray-700 font-medium py-2" onClick={() => setMenuAcik(false)}>Premium</Link>

            <div className="border-t border-gray-100 pt-3 mt-1 flex flex-col gap-2">
              {authYukleniyor ? null : kullanici ? (
                <>
                  <div className="flex items-center justify-between">
                    <Link href="/panel" onClick={() => setMenuAcik(false)} className="text-gray-800 font-semibold py-2">
                      Panelim
                    </Link>
                    <BildirimZili userId={kullanici.id} />
                  </div>
                  <p className="text-xs text-gray-400 px-1">{adSoyad}</p>
                  <button onClick={cikisYap} className="text-left text-red-600 font-medium py-2">
                    Çıkış Yap
                  </button>
                </>
              ) : (
                <>
                  <Link href="/giris" className="text-gray-700 font-medium py-2" onClick={() => setMenuAcik(false)}>Giriş Yap</Link>
                  <Link href="/kayit" className="bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-center" onClick={() => setMenuAcik(false)}>Kayıt Ol</Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
