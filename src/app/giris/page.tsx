"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function ceviriHata(mesaj: string): string {
  if (mesaj.includes("Invalid login credentials")) return "E-posta veya şifre hatalı.";
  if (mesaj.includes("Email not confirmed"))       return "E-posta adresiniz henüz doğrulanmadı. Gelen kutunuzu kontrol edin.";
  if (mesaj.includes("Too many requests"))         return "Çok fazla deneme yapıldı. Lütfen biraz bekleyin.";
  if (mesaj.includes("Network"))                   return "Bağlantı hatası. İnternet bağlantınızı kontrol edin.";
  return "Giriş yapılamadı. Lütfen tekrar deneyin.";
}

function GirisForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [form, setForm]             = useState({ email: "", sifre: "" });
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata]             = useState("");

  const next = searchParams.get("next") || "/";

  useEffect(() => {
    const urlHata = searchParams.get("hata");
    if (urlHata) setHata(decodeURIComponent(urlHata));
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setHata("");
    setYukleniyor(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email:    form.email,
      password: form.sifre,
    });

    if (error) {
      console.error("Giriş hatası:", error);
      setHata(ceviriHata(error.message));
      setYukleniyor(false);
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Giriş Yap</h1>
          <p className="text-gray-500 mt-2">İhale platformuna hoş geldiniz</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          {hata && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-6">
              {hata}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="email">
                E-posta Adresi
              </label>
              <input
                id="email"
                type="email"
                required
                placeholder="ornek@firma.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-700" htmlFor="sifre">
                  Şifre
                </label>
                <Link href="/sifremi-unuttum" className="text-sm text-blue-700 hover:underline">
                  Şifremi Unuttum
                </Link>
              </div>
              <input
                id="sifre"
                type="password"
                required
                placeholder="••••••••"
                value={form.sifre}
                onChange={(e) => setForm((f) => ({ ...f, sifre: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={yukleniyor}
              className="w-full bg-blue-700 text-white font-semibold py-3 rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {yukleniyor ? "Giriş yapılıyor..." : "Giriş Yap"}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-4 text-sm text-gray-400">veya</span>
            </div>
          </div>

          <p className="text-center text-sm text-gray-600">
            Hesabınız yok mu?{" "}
            <Link
              href={`/kayit${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}
              className="text-blue-700 font-semibold hover:underline"
            >
              Kayıt Olun
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

import { Suspense } from "react";

export default function GirisSayfasi() {
  return (
    <Suspense fallback={<div className="min-h-[calc(100vh-8rem)]" />}>
      <GirisForm />
    </Suspense>
  );
}
