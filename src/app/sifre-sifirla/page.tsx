"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SifreSifirla() {
  const router = useRouter();

  const [durum, setDurum]           = useState<"bekleniyor" | "hazir" | "gecersiz">("bekleniyor");
  const [form, setForm]             = useState({ sifre: "", sifreTekrar: "" });
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata]             = useState("");
  const [basarili, setBasarili]     = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let cozuldu = false;

    function coz(sessionVar: boolean) {
      if (cozuldu) return;
      cozuldu = true;
      setDurum(sessionVar ? "hazir" : "gecersiz");
    }

    // Auth callback'ten gelen cookie'yi okumayı dene
    supabase.auth.getSession().then(({ data: { session } }) => {
      coz(!!session);
    });

    // PASSWORD_RECOVERY event'ini dinle (implicit flow)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      coz(!!session);
    });

    // 4 saniye içinde session gelmezse geçersiz say
    const timer = setTimeout(() => coz(false), 4000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setHata("");

    if (form.sifre.length < 8) {
      setHata("Şifre en az 8 karakter olmalıdır.");
      return;
    }
    if (form.sifre !== form.sifreTekrar) {
      setHata("Şifreler eşleşmiyor.");
      return;
    }

    setYukleniyor(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: form.sifre });

    if (error) {
      console.error("Şifre güncelleme hatası:", error);
      setHata("Şifre güncellenemedi: " + error.message);
      setYukleniyor(false);
      return;
    }

    setBasarili(true);
    setTimeout(() => router.push("/giris"), 2000);
  }

  // ── Yükleniyor ────────────────────────────────────────────
  if (durum === "bekleniyor") {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
        <div className="text-center flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Doğrulama bağlantısı kontrol ediliyor...</p>
        </div>
      </div>
    );
  }

  // ── Geçersiz / Süresi Dolmuş ─────────────────────────────
  if (durum === "gecersiz") {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center flex flex-col items-center gap-5">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900 mb-2">Bağlantı geçersiz</p>
              <p className="text-gray-500 text-sm">
                Şifre sıfırlama bağlantısı süresi dolmuş ya da daha önce kullanılmış.
                Yeni bir bağlantı isteyin.
              </p>
            </div>
            <Link
              href="/sifremi-unuttum"
              className="w-full text-center bg-blue-700 text-white font-semibold py-3 rounded-lg hover:bg-blue-800 transition-colors"
            >
              Yeni Bağlantı İste
            </Link>
            <Link href="/giris" className="text-sm text-gray-400 hover:text-gray-700">
              Giriş sayfasına dön
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Başarılı ─────────────────────────────────────────────
  if (basarili) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center flex flex-col items-center gap-4">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-xl font-bold text-gray-900">Şifreniz güncellendi</p>
            <p className="text-gray-500 text-sm">Giriş sayfasına yönlendiriliyorsunuz...</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Form ─────────────────────────────────────────────────
  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Yeni Şifre Belirle</h1>
          <p className="text-gray-500 mt-2">Hesabınız için yeni bir şifre oluşturun</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          {hata && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-6">
              {hata}
              <div className="mt-2">
                <Link href="/sifremi-unuttum" className="font-semibold underline">
                  Yeniden sıfırlama bağlantısı iste →
                </Link>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="sifre">
                Yeni Şifre
              </label>
              <input
                id="sifre"
                type="password"
                required
                autoFocus
                minLength={6}
                placeholder="En az 8 karakter"
                value={form.sifre}
                onChange={(e) => setForm((f) => ({ ...f, sifre: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="sifreTekrar">
                Yeni Şifre (Tekrar)
              </label>
              <input
                id="sifreTekrar"
                type="password"
                required
                placeholder="Şifrenizi tekrar girin"
                value={form.sifreTekrar}
                onChange={(e) => setForm((f) => ({ ...f, sifreTekrar: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={yukleniyor}
              className="w-full bg-blue-700 text-white font-semibold py-3 rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {yukleniyor ? "Kaydediliyor..." : "Şifremi Güncelle"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
