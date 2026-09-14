"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Kullanici, KimlikDogrulamaBasvurusu } from "@/lib/types";

const DURUM_BADGE: Record<string, { etiket: string; cls: string }> = {
  bekliyor:   { etiket: "Doğrulama Bekleniyor", cls: "bg-amber-100 text-amber-700" },
  onaylandi:  { etiket: "Doğrulandı",           cls: "bg-green-100 text-green-700" },
  reddedildi: { etiket: "Reddedildi",           cls: "bg-red-100 text-red-600" },
};

function maskele(deger: string | null | undefined): string {
  if (!deger) return "—";
  if (deger.length <= 4) return "•".repeat(deger.length);
  return "•".repeat(deger.length - 4) + deger.slice(-4);
}

function tarihFormat(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

const BELGE_ETIKETLERI: { alan: keyof KimlikDogrulamaBasvurusu; etiket: string }[] = [
  { alan: "kimlik_on_url", etiket: "Kimlik Ön Yüz" },
  { alan: "kimlik_arka_url", etiket: "Kimlik Arka Yüz" },
  { alan: "selfie_url", etiket: "Selfie" },
  { alan: "imza_sirkuleri_url", etiket: "İmza Sirküleri" },
  { alan: "ticaret_sicil_url", etiket: "Ticaret Sicil Gazetesi" },
];

export default function HesapBilgilerim() {
  const router = useRouter();
  const [kullanici, setKullanici] = useState<Kullanici | null>(null);
  const [basvuru, setBasvuru] = useState<KimlikDogrulamaBasvurusu | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    async function yukle() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.replace("/giris?next=" + encodeURIComponent("/panel/hesap-bilgilerim")); return; }

      const [{ data: kullaniciData }, { data: basvuruData }] = await Promise.all([
        supabase.from("kullanicilar").select("*").eq("id", session.user.id).single(),
        supabase
          .from("kimlik_dogrulama_basvurulari")
          .select("*")
          .eq("kullanici_id", session.user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      setKullanici(kullaniciData as Kullanici);
      setBasvuru(basvuruData as KimlikDogrulamaBasvurusu | null);
      setYukleniyor(false);
    }
    yukle();
  }, [router]);

  if (yukleniyor || !kullanici) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="h-64 bg-white border border-gray-200 rounded-2xl animate-pulse" />
      </div>
    );
  }

  const durum = kullanici.kimlik_dogrulama_durumu ?? "bekliyor";

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/panel" className="hover:text-blue-700">Panelim</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Hesap Bilgilerim</span>
      </nav>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Hesap Bilgilerim</h1>
            <p className="text-gray-500 text-sm">{kullanici.email}</p>
          </div>
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap ${DURUM_BADGE[durum].cls}`}>
            {DURUM_BADGE[durum].etiket}
          </span>
        </div>

        {durum === "reddedildi" && kullanici.kimlik_dogrulama_notu && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-4">
            <p className="font-semibold mb-1">Red sebebi</p>
            <p>{kullanici.kimlik_dogrulama_notu}</p>
          </div>
        )}

        {durum !== "onaylandi" && (
          <Link
            href="/onboarding"
            className="inline-block self-start bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-800 transition-colors text-sm"
          >
            {durum === "reddedildi" ? "Yeniden Başvur" : "Kimlik Doğrulamayı Tamamla"} →
          </Link>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-400 mb-1">Ad Soyad</p>
            <p className="font-semibold text-gray-900">{kullanici.ad_soyad}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Firma Adı</p>
            <p className="font-semibold text-gray-900">{kullanici.firma_adi ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">{basvuru?.kisi_turu === "kurumsal" ? "Vergi No" : "TC Kimlik No"}</p>
            <p className="font-semibold text-gray-900">
              {basvuru?.kisi_turu === "kurumsal" ? maskele(basvuru?.vergi_no) : maskele(basvuru?.tc_kimlik_no)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Telefon</p>
            <p className="font-semibold text-gray-900">{kullanici.telefon ?? "—"}</p>
          </div>
        </div>

        {basvuru && (
          <div className="pt-2 border-t border-gray-100">
            <p className="text-sm font-semibold text-gray-700 mb-2">Yüklenen Belgeler</p>
            <p className="text-xs text-gray-400 mb-3">Başvuru tarihi: {tarihFormat(basvuru.created_at)}</p>
            <ul className="flex flex-col gap-1.5">
              {BELGE_ETIKETLERI.filter((b) => basvuru[b.alan]).map((b) => (
                <li key={b.alan} className="text-sm text-gray-700 flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {b.etiket}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
