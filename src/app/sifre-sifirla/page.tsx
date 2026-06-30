"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SifreSifirla() {
  const router = useRouter();
  const [form, setForm]             = useState({ sifre: "", sifreTekrar: "" });
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata]             = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setHata("");

    if (form.sifre.length < 6) {
      setHata("Şifre en az 6 karakter olmalıdır.");
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
      setHata("Şifre güncellenemedi. Bağlantı süresi dolmuş olabilir, yeniden şifre sıfırlama isteği gönderin.");
      setYukleniyor(false);
      return;
    }

    router.push("/giris?mesaj=sifre-guncellendi");
  }

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
              {hata.includes("Bağlantı") && (
                <div className="mt-2">
                  <Link href="/sifremi-unuttum" className="font-semibold underline">
                    Yeniden sıfırlama bağlantısı iste →
                  </Link>
                </div>
              )}
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
                minLength={6}
                placeholder="En az 6 karakter"
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
