"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Paket {
  isim: string;
  hak: string;
  normalFiyat: string;
  indirimliFiyat: string;
  fiyatAlt: string;
  aciklama: string;
  ozellikler: string[];
  popüler: boolean;
  ctaHref: string;
  vurgu: "gray" | "teal";
}

const PAKETLER: Paket[] = [
  {
    isim: "Temel Paket",
    hak: "1 teklif hakkı",
    normalFiyat: "999₺",
    indirimliFiyat: "699₺",
    fiyatAlt: "tek seferlik",
    aciklama: "Bir ihaleye teklif vermek isteyen bireysel kullanıcılar için.",
    ozellikler: [
      "1 teklif hakkı (tek seferlik)",
      "Hak süresiz geçerlidir",
      "Tüm ihaleler için geçerli",
      "Teklif takip paneli",
    ],
    popüler: false,
    ctaHref: "/odeme/teklif-temel",
    vurgu: "gray",
  },
  {
    isim: "Kurumsal Paket",
    hak: "Sınırsız teklif",
    normalFiyat: "3.299₺",
    indirimliFiyat: "2.299₺",
    fiyatAlt: "/ ay",
    aciklama: "Aktif müteahhitler ve kurumsal firmalar için limitsiz teklif imkânı.",
    ozellikler: [
      "Sınırsız teklif hakkı",
      "Aylık otomatik yenileme",
      "Tüm ihaleler için geçerli",
      "Teklif analitikleri",
      "Öncelikli bildirimler",
      "Öncelikli müşteri desteği",
    ],
    popüler: true,
    ctaHref: "/odeme/teklif-kurumsal",
    vurgu: "teal",
  },
];

const KART_CLS: Record<string, string> = {
  gray: "border-gray-200 bg-white",
  teal: "border-teal-500 bg-white ring-2 ring-teal-500 ring-offset-2",
};

const CTA_CLS: Record<string, string> = {
  gray: "bg-gray-900 text-white hover:bg-gray-700",
  teal: "bg-teal-700 text-white hover:bg-teal-800 shadow-md shadow-teal-200",
};

const HAK_CLS: Record<string, string> = {
  gray: "bg-gray-50 text-gray-700 border-gray-200",
  teal: "bg-teal-50 text-teal-700 border-teal-100",
};

export default function TeklifPaketiSayfasi() {
  const [performansIndirimi, setPerformansIndirimi] = useState(false);
  // null: bilinmiyor (giriş yapılmamış / henüz yüklenmedi) — bu durumda
  // "hakkınız doldu" uyarısı yanlışlıkla gösterilmesin diye gizli tutulur.
  const [kalanTeklifHakki, setKalanTeklifHakki] = useState<number | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return;
      supabase.rpc("performans_indirimi_uygulanir_mi", { p_kullanici_id: session.user.id })
        .then(({ data }) => setPerformansIndirimi(Boolean(data)));
      supabase.from("kullanicilar").select("kalan_teklif_hakki").eq("id", session.user.id).single()
        .then(({ data }) => setKalanTeklifHakki(data?.kalan_teklif_hakki ?? null));
    });
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

      {/* Başlık */}
      <div className="text-center mb-14">
        <span className="inline-block text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full mb-4 tracking-wide uppercase">
          Teklif Paketleri
        </span>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Teklif Hakkınızı Genişletin</h1>
        <p className="text-gray-500 text-lg max-w-xl mx-auto leading-relaxed">
          İlk teklifiniz ücretsizdir.
          Daha fazlası için aşağıdaki paketlerden birini seçin.
        </p>

        {/* Mevcut hak göstergesi — yalnızca kalan hak 0 ise gösterilir */}
        {kalanTeklifHakki === 0 && (
          <div className="inline-flex items-center gap-2 mt-6 bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium px-5 py-2.5 rounded-full">
            <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Teklif hakkınız doldu. Teklif vermek için bir paket seçin.
          </div>
        )}

        {performansIndirimi && (
          <div className="inline-flex items-center gap-2 mt-4 ml-3 bg-green-50 border border-green-200 text-green-800 text-sm font-bold px-5 py-2.5 rounded-full">
            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            Performans İndirimi: %50 — yüksek puanınız ve sınırsız paketiniz sayesinde kazandınız!
          </div>
        )}
      </div>

      {/* Paket Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16 max-w-3xl mx-auto">
        {PAKETLER.map((paket) => {
          const performansFiyat = (parseFloat(paket.indirimliFiyat.replace(/[.₺]/g, "").replace(",", ".")) / 2);
          const gosterilenFiyat = performansIndirimi
            ? `${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(performansFiyat)}₺`
            : paket.indirimliFiyat;

          return (
            <div key={paket.isim}
              className={`relative rounded-2xl border p-8 flex flex-col ${KART_CLS[paket.vurgu]}`}>
              {paket.popüler && (
                <div className="absolute -top-3.5 left-0 right-0 flex justify-center">
                  <span className="bg-teal-700 text-white text-xs font-bold px-4 py-1 rounded-full shadow">
                    En Popüler
                  </span>
                </div>
              )}

              {/* Hak sayısı rozeti */}
              <div className={`inline-flex items-center gap-1.5 self-start text-xs font-bold px-3 py-1.5 rounded-full border mb-5 ${HAK_CLS[paket.vurgu]}`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {paket.hak}
              </div>

              <div className="mb-6">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{paket.isim}</p>

                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm text-gray-400 line-through">{paket.normalFiyat}</span>
                  <span className="text-[10px] font-bold bg-amber-400 text-amber-950 px-2 py-0.5 rounded-full whitespace-nowrap">
                    🎉 Kuruluşa Özel — Kısa Süreliğine!
                  </span>
                </div>

                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-4xl font-bold text-gray-900">{gosterilenFiyat}</span>
                  <span className="text-gray-400 text-sm">{paket.fiyatAlt}</span>
                </div>

                {performansIndirimi && (
                  <span className="inline-block text-[10px] font-bold bg-green-400 text-green-950 px-2 py-0.5 rounded-full mb-2">
                    Performans İndirimi: %50
                  </span>
                )}

                <p className="text-sm text-gray-500 leading-relaxed">{paket.aciklama}</p>
              </div>

              <Link href={paket.ctaHref}
                className={`w-full text-center text-sm font-semibold py-3 rounded-xl transition-colors mb-7 block ${CTA_CLS[paket.vurgu]}`}>
                Paketi Satın Al
              </Link>

              <ul className="flex flex-col gap-3 flex-1">
                {paket.ozellikler.map((o) => (
                  <li key={o} className="flex items-start gap-2.5">
                    <svg className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-gray-700 leading-snug">{o}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Karşılaştırma */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-16">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Paket Karşılaştırması</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-6 py-3 font-semibold text-gray-600 w-2/5">Özellik</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Ücretsiz</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Temel Paket</th>
                <th className="text-center px-4 py-3 font-semibold text-teal-700 bg-teal-50">Kurumsal Paket</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                ["Teklif hakkı",          "1",        "1",       "Sınırsız"],
                ["Geçerlilik",            "Tek sef.", "Süresiz", "Aylık yenileme"],
                ["Teklif takip paneli",   "✓",        "✓",       "✓"],
                ["Öncelikli bildirimler", "—",        "—",       "✓"],
                ["Teklif analitikleri",   "—",        "—",       "✓"],
                ["Destek kanalı",         "E-posta",  "E-posta", "Öncelikli"],
              ].map(([ozellik, ucretsiz, temel, kurumsal]) => (
                <tr key={ozellik} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3.5 text-gray-700 font-medium">{ozellik}</td>
                  <td className="px-4 py-3.5 text-center text-gray-400">{ucretsiz}</td>
                  <td className="px-4 py-3.5 text-center text-gray-600">{temel}</td>
                  <td className="px-4 py-3.5 text-center text-teal-700 font-semibold bg-teal-50/50">{kurumsal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SSS */}
      <div className="max-w-2xl mx-auto mb-16">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">Sık Sorulan Sorular</h2>
        <div className="flex flex-col gap-4">
          {[
            {
              s: "İlk teklifim neden ücretsiz?",
              c: "Hesap oluştururken, ilk teklifiniz ücretsiz olacak şekilde otomatik olarak 1 teklif hakkı tanınır. Bu hak herhangi bir ihaleye teklif verdiğinizde otomatik düşer.",
            },
            {
              s: "Temel Paket'teki hak ne zaman sona erer?",
              c: "Temel Paket'teki hak süresizdir. Satın aldığınız an aktive edilir ve siz kullanana kadar hesabınızda kalır.",
            },
            {
              s: "Kurumsal Paket aylık mı ücretlendirilir?",
              c: "Evet, Kurumsal Paket aylık abonelik modeliyle çalışır. İptal ederseniz dönem sonuna kadar sınırsız teklif hakkınız devam eder.",
            },
            {
              s: "Performans İndirimi nasıl kazanılır?",
              c: "Sınırsız (Kurumsal Paket) teklif hakkına sahip, en az 10 yorumu olan ve ortalama puanı 4,5 ve üzeri olan müteahhitlere teklif paketi ücretlerinde otomatik olarak %50 indirim uygulanır.",
            },
            {
              s: "Birden fazla Temel Paket satın alabilir miyim?",
              c: "Evet, Temel Paket'i dilediğiniz kadar satın alabilirsiniz. Haklar toplanarak hesabınıza eklenir.",
            },
          ].map((faq) => (
            <div key={faq.s} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <p className="font-semibold text-gray-900 mb-2">{faq.s}</p>
              <p className="text-sm text-gray-500 leading-relaxed">{faq.c}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Alt bağlantılar */}
      <div className="flex items-center justify-center gap-5 text-sm">
        <Link href="/panel" className="text-gray-500 hover:text-blue-700 font-medium transition-colors">
          ← Panele Dön
        </Link>
        <span className="text-gray-200">|</span>
        <Link href="/ihaleler" className="text-gray-500 hover:text-blue-700 font-medium transition-colors">
          İhalelere Gözat
        </Link>
        <span className="text-gray-200">|</span>
        <Link href="/iletisim" className="text-gray-500 hover:text-blue-700 font-medium transition-colors">
          Destek Al
        </Link>
      </div>
    </div>
  );
}
