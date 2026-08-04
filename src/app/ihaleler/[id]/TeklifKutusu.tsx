"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

interface Props {
  ihaleId: string;
  baslangicFiyati: number;
  durum: string;
  kalanGun: number;
}

function formatPara(tutar: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency", currency: "TRY", minimumFractionDigits: 0,
  }).format(tutar);
}

// Pro pakette kalan_teklif_hakki bu değere eşit veya büyük olursa sınırsız sayılır
const SINIRSIN_ESIK = 99999;

function hakEtiket(hak: number): string {
  return hak >= SINIRSIN_ESIK ? "Sınırsız" : `${hak} hak kaldı`;
}

function hakRenk(hak: number): string {
  if (hak >= SINIRSIN_ESIK) return "text-green-600";
  if (hak === 0)             return "text-red-600";
  if (hak <= 2)              return "text-amber-600";
  return "text-green-600";
}

export default function TeklifKutusu({ ihaleId, baslangicFiyati, durum, kalanGun }: Props) {
  const router = useRouter();
  const taslakAnahtari = `teklif-taslak-${ihaleId}`;

  const [kullanici,   setKullanici]   = useState<User | null | undefined>(undefined);
  const [kalanHak,    setKalanHak]    = useState<number | null>(null);
  const [hakYuklendi, setHakYuklendi] = useState(false);
  const [tutar,       setTutar]       = useState("");
  const [yukleniyor,  setYukleniyor]  = useState(false);
  const [hata,        setHata]        = useState("");
  const [basarili,    setBasarili]    = useState(false);
  const [gonderilenTutar, setGonderilenTutar] = useState(0);

  useEffect(() => {
    const supabase = createClient();

    async function hakGetir(userId: string) {
      const { data } = await supabase
        .from("kullanicilar")
        .select("kalan_teklif_hakki")
        .eq("id", userId)
        .single();
      setKalanHak(data?.kalan_teklif_hakki ?? 0);
      setHakYuklendi(true);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setKullanici(session?.user ?? null);
      if (session?.user) hakGetir(session.user.id);
      else setHakYuklendi(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setKullanici(session?.user ?? null);
      if (session?.user) hakGetir(session.user.id);
      else { setKalanHak(null); setHakYuklendi(true); }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Kayıt/giriş sayfasına yönlendirilip geri dönüldüğünde girilen
  // tutarın kaybolmaması için taslağı geri yükle.
  useEffect(() => {
    try {
      const kayitli = localStorage.getItem(taslakAnahtari);
      if (kayitli) setTutar(kayitli);
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      if (tutar) localStorage.setItem(taslakAnahtari, tutar);
      else localStorage.removeItem(taslakAnahtari);
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutar]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tutar) return;

    // Giriş yapılmamışsa: girilen tutar zaten localStorage'da taslak
    // olarak tutuluyor, kayıt/giriş sonrası bu sayfaya dönüldüğünde
    // otomatik geri yüklenir — kullanıcının tek yapması gereken
    // "Teklif Ver"e tekrar basmak.
    if (!kullanici) {
      router.push(`/kayit?next=${encodeURIComponent(`/ihaleler/${ihaleId}`)}`);
      return;
    }

    if (kalanHak !== null && kalanHak <= 0) { setHata("Teklif hakkınız kalmadı."); return; }

    const tutarNum = Number(tutar);
    if (tutarNum <= 0) { setHata("Geçerli bir tutar girin."); return; }

    setHata("");
    setYukleniyor(true);
    const supabase = createClient();

    const { error } = await supabase.from("teklifler").insert({
      ihale_id:     ihaleId,
      kullanici_id: kullanici.id,
      tutar:        tutarNum,
    });

    setYukleniyor(false);

    if (error) {
      if (error.code === "23505") {
        setHata("Bu ihaleyie zaten teklif verdiniz.");
      } else {
        setHata("Teklif gönderilemedi: " + error.message);
      }
      return;
    }

    // DB trigger kalan_teklif_hakki'ı otomatik düşürür; local state'i optimistik güncelle
    if (kalanHak !== null && kalanHak < SINIRSIN_ESIK) {
      setKalanHak((h) => Math.max(0, (h ?? 1) - 1));
    }

    try { localStorage.removeItem(taslakAnahtari); } catch { /* noop */ }
    setGonderilenTutar(tutarNum);
    setBasarili(true);
    setTutar("");
  }

  // İhale aktif değil
  if (durum !== "aktif") {
    return (
      <button disabled className="block w-full text-center bg-gray-200 text-gray-500 font-semibold py-3 rounded-lg cursor-not-allowed mb-3">
        {{ beklemede: "Henüz Başlamadı", tamamlandi: "Tamamlandı", iptal: "İptal Edildi" }[durum] ?? durum}
      </button>
    );
  }

  // Durum "aktif" olsa da son teklif tarihi geçmişse teklif kabul edilmez
  if (kalanGun <= 0) {
    return (
      <button disabled className="block w-full text-center bg-gray-200 text-gray-500 font-semibold py-3 rounded-lg cursor-not-allowed mb-3">
        Teklif süresi doldu
      </button>
    );
  }

  // Yükleniyor
  if (kullanici === undefined || !hakYuklendi) {
    return <div className="h-12 bg-gray-100 rounded-lg animate-pulse mb-3" />;
  }

  // Teklif hakkı yok → paket satın al
  if (kullanici && kalanHak !== null && kalanHak <= 0) {
    return (
      <div className="mb-3">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-3 text-center">
          <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-amber-800 mb-1">Teklif hakkınız doldu</p>
          <p className="text-xs text-amber-600">Teklif verebilmek için paket satın alın.</p>
        </div>
        <Link
          href="/teklif-paketi"
          className="block w-full text-center bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
        >
          Paket Satın Al →
        </Link>
        {kalanGun > 0 && (
          <p className="text-xs text-gray-400 text-center mt-2">İhale son {kalanGun} gün</p>
        )}
      </div>
    );
  }

  // Teklif başarılı
  if (basarili) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-3 text-center">
        <p className="text-green-700 font-semibold text-sm">Teklifiniz alındı!</p>
        <p className="text-green-600 text-xs mt-1">{formatPara(gonderilenTutar)} tutarında teklif gönderildi.</p>
        {kalanHak !== null && kalanHak < SINIRSIN_ESIK && (
          <p className="text-xs text-gray-400 mt-2">Kalan hak: {kalanHak}</p>
        )}
      </div>
    );
  }

  // Teklif formu — girişsiz kullanıcı da tutarı doldurabilir; submit
  // anında giriş yapılmamışsa kayıt/giriş sayfasına yönlendirilir
  // (bkz. handleSubmit). Bu yüzden burada "kullanici === null" için
  // ayrı bir görünüm YOK — form her zaman gösterilir.
  return (
    <form onSubmit={handleSubmit} className="mb-3">
      {/* Kalan hak */}
      {kullanici && kalanHak !== null && (
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-400">Teklif hakkı</span>
          <span className={`text-xs font-bold ${hakRenk(kalanHak)}`}>
            {hakEtiket(kalanHak)}
          </span>
        </div>
      )}

      {!kullanici && (
        <p className="text-xs text-gray-500 mb-3">
          Teklif vermek için giriş yapmanız gerekir — tutarı girip &quot;Teklif Ver&quot;e bastığınızda giriş/kayıt sayfasına yönlendirilirsiniz, girdiğiniz tutar kaybolmaz.
        </p>
      )}

      {hata && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-2.5 mb-3">{hata}</div>
      )}

      <div className="mb-3">
        <label className="block text-xs text-gray-500 mb-1.5">Teklif Tutarınız (₺)</label>
        <input
          type="number" required min="1" placeholder={String(baslangicFiyati)}
          value={tutar} onChange={(e) => setTutar(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-400 mt-1">Başlangıç: {formatPara(baslangicFiyati)}</p>
      </div>

      <button
        type="submit" disabled={yukleniyor}
        className="block w-full text-center bg-blue-700 text-white font-semibold py-3 rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {yukleniyor ? "Gönderiliyor..." : kullanici ? "Teklif Ver" : "Giriş Yap ve Teklif Ver"}
      </button>

      {kalanGun > 0 && (
        <p className="text-xs text-gray-400 text-center mt-2">Son {kalanGun} gün</p>
      )}
    </form>
  );
}
