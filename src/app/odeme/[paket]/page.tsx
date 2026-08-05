"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

// ─── Paket bilgileri ──────────────────────────────────────────────────────────

const PAKET_BILGI: Record<string, {
  isim: string;
  fiyat: string;
  fiyatGoster: string;
  aciklama: string;
  renk: "blue" | "purple" | "gray" | "teal";
  geriHref: string;
}> = {
  premium:   { isim: "Premium Üyelik",          fiyat: "500.00",  fiyatGoster: "500₺/ay",      aciklama: "Sınırsız ihale, 45 güne kadar süre uzatma",    renk: "blue",   geriHref: "/premium"       },
  kurumsal:  { isim: "Kurumsal Üyelik",          fiyat: "2499.00", fiyatGoster: "2.499₺/ay",    aciklama: "Premium'ın tüm özellikleri + çoklu kullanıcı", renk: "purple", geriHref: "/premium"       },
  baslangic: { isim: "Başlangıç Teklif Paketi",  fiyat: "299.00",  fiyatGoster: "299₺",         aciklama: "5 teklif hakkı, süresiz geçerli",              renk: "gray",   geriHref: "/teklif-paketi" },
  standart:  { isim: "Standart Teklif Paketi",   fiyat: "699.00",  fiyatGoster: "699₺",         aciklama: "15 teklif hakkı, süresiz geçerli",             renk: "blue",   geriHref: "/teklif-paketi" },
  pro:       { isim: "Pro Teklif Paketi",         fiyat: "1499.00", fiyatGoster: "1.499₺/ay",   aciklama: "Sınırsız teklif hakkı, aylık yenileme",        renk: "teal",   geriHref: "/teklif-paketi" },
};

const RENK_CLS = {
  blue:   "bg-blue-700",
  purple: "bg-purple-700",
  gray:   "bg-gray-700",
  teal:   "bg-teal-700",
};

// Iyzico sandbox test kartları
const TEST_KARTLAR = [
  { aciklama: "Başarılı ödeme",  no: "5528 7900 0000 0008", ay: "12", yil: "2030", cvv: "123" },
  { aciklama: "Başarısız ödeme", no: "5528 7900 0000 0016", ay: "12", yil: "2030", cvv: "123" },
];

// ─── Kart numarası formatlayıcı ───────────────────────────────────────────────

function kartNoFormat(val: string): string {
  return val.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}

function tarihFormat(val: string): string {
  const temiz = val.replace(/\D/g, "").slice(0, 4);
  if (temiz.length >= 3) return `${temiz.slice(0, 2)} / ${temiz.slice(2)}`;
  if (temiz.length === 2) return `${temiz} / `;
  return temiz;
}

// ─── Ana bileşen ─────────────────────────────────────────────────────────────

export default function OdemeSayfasi({ params }: { params: Promise<{ paket: string }> }) {
  const { paket } = use(params);
  const router = useRouter();

  const bilgi = PAKET_BILGI[paket];

  const [kullanici,  setKullanici]  = useState<User | null | undefined>(undefined);
  const [kartSahibi, setKartSahibi] = useState("");
  const [kartNo,     setKartNo]     = useState("");
  const [tarih,      setTarih]      = useState("");  // "MM / YY"
  const [cvv,        setCvv]        = useState("");
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata,       setHata]       = useState("");
  const [testAcik,   setTestAcik]   = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setKullanici(session?.user ?? null);
    });
  }, []);

  // Geçersiz paket
  if (!bilgi) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <p className="text-gray-500 mb-4">Geçersiz paket seçimi.</p>
        <Link href="/" className="text-blue-600 hover:underline">Ana sayfaya dön</Link>
      </div>
    );
  }

  // Yükleniyor
  if (kullanici === undefined) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24">
        <div className="h-64 bg-white border border-gray-200 rounded-2xl animate-pulse" />
      </div>
    );
  }

  // Giriş yapılmamış
  if (kullanici === null) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <p className="text-gray-700 font-medium mb-4">Ödeme yapmak için giriş yapmalısınız.</p>
        <Link
          href={`/giris?next=/odeme/${paket}`}
          className="inline-block bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl hover:bg-blue-800 transition-colors"
        >
          Giriş Yap
        </Link>
      </div>
    );
  }

  async function handleOde(e: React.FormEvent) {
    e.preventDefault();
    setHata("");

    // Tarih parse: "MM / YY" → { ay, yil }
    const tarihTemiz = tarih.replace(/\s/g, "").replace("/", "");
    const sonAy  = tarihTemiz.slice(0, 2);
    const sonYil = `20${tarihTemiz.slice(2, 4)}`;

    if (sonAy.length < 2 || sonYil.length < 4) {
      setHata("Geçerlilik tarihi formatı yanlış (AA / YY).");
      return;
    }

    setYukleniyor(true);

    try {
      const res = await fetch("/api/odeme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paket,
          kart: {
            kartSahibi: kartSahibi.trim(),
            kartNo:     kartNo.replace(/\s/g, ""),
            sonAy,
            sonYil,
            cvv,
          },
        }),
      });

      const veri = await res.json();

      if (!res.ok || !veri.basarili) {
        setHata(veri.hata ?? "Ödeme işlemi başarısız oldu.");
        setYukleniyor(false);
        return;
      }

      // Başarılı → panel'e yönlendir
      router.push("/panel?odeme=basarili");

    } catch {
      setHata("Bağlantı hatası, lütfen tekrar deneyin.");
      setYukleniyor(false);
    }
  }

  function testKartUygula(kart: typeof TEST_KARTLAR[0]) {
    setKartNo(kart.no);
    setTarih(`${kart.ay} / ${kart.yil.slice(2)}`);
    setCvv(kart.cvv);
    setKartSahibi("Test Kullanici");
    setTestAcik(false);
  }

  const renkCls = RENK_CLS[bilgi.renk];

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center px-4 pt-16 pb-24">
      <div className="w-full max-w-md">

        {/* Geri */}
        <Link href={bilgi.geriHref}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-700 mb-6 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Geri
        </Link>

        {/* Paket özeti */}
        <div className={`${renkCls} text-white rounded-2xl p-6 mb-6 shadow-sm`}>
          <p className="text-sm font-medium opacity-80 mb-1">Seçilen Paket</p>
          <h1 className="text-2xl font-bold mb-1">{bilgi.isim}</h1>
          <p className="text-sm opacity-80 mb-4">{bilgi.aciklama}</p>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold">{bilgi.fiyatGoster.split("/")[0]}</span>
            {bilgi.fiyatGoster.includes("/") && (
              <span className="text-sm opacity-70">/ {bilgi.fiyatGoster.split("/")[1]}</span>
            )}
          </div>
        </div>

        {/* Sandbox test kartları */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
          <button
            type="button"
            onClick={() => setTestAcik((p) => !p)}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold bg-amber-400 text-white px-1.5 py-0.5 rounded">SANDBOX</span>
              <span className="text-xs font-semibold text-amber-800">Test modu — gerçek ödeme alınmaz</span>
            </div>
            <svg className={`w-4 h-4 text-amber-600 transition-transform ${testAcik ? "rotate-180" : ""}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {testAcik && (
            <div className="mt-3 flex flex-col gap-2">
              {TEST_KARTLAR.map((k) => (
                <button
                  key={k.no}
                  type="button"
                  onClick={() => testKartUygula(k)}
                  className="flex items-center justify-between bg-white border border-amber-200 rounded-lg px-3 py-2 text-left hover:bg-amber-50 transition-colors"
                >
                  <div>
                    <p className="text-xs font-semibold text-gray-800">{k.aciklama}</p>
                    <p className="text-xs text-gray-500 font-mono">{k.no}</p>
                  </div>
                  <span className="text-xs text-amber-700 font-medium">Kullan →</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Kart formu */}
        <form onSubmit={handleOde} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-bold text-gray-900 mb-5">Kart Bilgileri</h2>

          {hata && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3.5 mb-4 flex items-start gap-2.5">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {hata}
            </div>
          )}

          {/* Kart sahibi */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Kart Üzerindeki İsim</label>
            <input
              required
              type="text"
              placeholder="AD SOYAD"
              value={kartSahibi}
              onChange={(e) => setKartSahibi(e.target.value.toUpperCase())}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
            />
          </div>

          {/* Kart numarası */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Kart Numarası</label>
            <div className="relative">
              <input
                required
                type="text"
                inputMode="numeric"
                placeholder="0000 0000 0000 0000"
                value={kartNo}
                onChange={(e) => setKartNo(kartNoFormat(e.target.value))}
                maxLength={19}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-12 text-gray-900 text-sm font-mono placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow tracking-widest"
              />
              <svg className="absolute right-3.5 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-300" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z" />
              </svg>
            </div>
          </div>

          {/* Son kullanma + CVV */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Son Kullanma Tarihi</label>
              <input
                required
                type="text"
                inputMode="numeric"
                placeholder="AA / YY"
                value={tarih}
                onChange={(e) => setTarih(tarihFormat(e.target.value))}
                maxLength={7}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm font-mono placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">CVV</label>
              <input
                required
                type="text"
                inputMode="numeric"
                placeholder="123"
                value={cvv}
                onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                maxLength={4}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm font-mono placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
              />
            </div>
          </div>

          {/* Ödeme butonu */}
          <button
            type="submit"
            disabled={yukleniyor}
            className={`w-full ${renkCls} text-white font-bold py-3.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2`}
          >
            {yukleniyor ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Ödeme İşleniyor...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Güvenli Ödeme Yap — {bilgi.fiyatGoster}
              </>
            )}
          </button>

          {/* Güvenlik notu */}
          <div className="flex items-center justify-center gap-4 mt-4">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
              <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              256-bit SSL
            </div>
            <div className="text-[11px] text-gray-400">Iyzico güvencesiyle</div>
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
              <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Kart bilgisi saklanmaz
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
