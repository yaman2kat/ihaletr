"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SifremiUnuttum() {
  const [email, setEmail]               = useState("");
  const [yukleniyor, setYukleniyor]     = useState(false);
  const [gonderildi, setGonderildi]     = useState(false);
  const [hata, setHata]                 = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setHata("");
    setYukleniyor(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://ihaletr-61r6.vercel.app/sifre-sifirla",
    });

    setYukleniyor(false);

    if (error) {
      console.error("Şifre sıfırlama hatası:", error);
      setHata("E-posta gönderilemedi. Lütfen tekrar deneyin.");
      return;
    }

    setGonderildi(true);
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Şifremi Unuttum</h1>
          <p className="text-gray-500 mt-2">
            Kayıtlı e-posta adresinizi girin, şifre sıfırlama bağlantısı gönderelim
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          {gonderildi ? (
            <div className="text-center flex flex-col items-center gap-5">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <div>
                <p className="text-xl font-bold text-gray-900 mb-2">
                  Şifre sıfırlama linki email adresinize gönderildi
                </p>
                <p className="text-gray-500 text-sm">
                  <strong className="text-gray-700">{email}</strong> adresine gönderdik.
                  Gelen kutunuzu ve spam klasörünü kontrol edin.
                </p>
              </div>

              <Link
                href="/giris"
                className="w-full text-center bg-blue-700 text-white font-semibold py-3 rounded-lg hover:bg-blue-800 transition-colors"
              >
                Giriş Sayfasına Dön
              </Link>
            </div>
          ) : (
            <>
              {hata && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-6">
                  {hata}
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 mb-1.5"
                  >
                    E-posta Adresi
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    autoFocus
                    placeholder="ornek@firma.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={yukleniyor}
                  className="w-full bg-blue-700 text-white font-semibold py-3 rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {yukleniyor ? "Gönderiliyor..." : "Şifre Sıfırlama Linki Gönder"}
                </button>
              </form>

              <p className="text-center text-sm text-gray-600 mt-6">
                <Link href="/giris" className="text-blue-700 hover:underline">
                  ← Giriş sayfasına dön
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
