"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { KullaniciRol } from "@/lib/types";

function ceviriHata(mesaj: string): string {
  if (mesaj.includes("User already registered") || mesaj.includes("already been registered"))
    return "Bu e-posta adresi zaten kayıtlı. Giriş yapmayı deneyin.";
  if (mesaj.includes("Password should be"))
    return "Şifre en az 6 karakter olmalıdır.";
  if (mesaj.includes("Invalid email"))
    return "Geçerli bir e-posta adresi girin.";
  if (mesaj.includes("Network"))
    return "Bağlantı hatası. İnternet bağlantınızı kontrol edin.";
  return "Kayıt oluşturulamadı. Lütfen tekrar deneyin.";
}

export default function KayitSayfasi() {
  const [rol, setRol] = useState<KullaniciRol | null>(null);
  const [form, setForm] = useState({
    adSoyad:     "",
    email:       "",
    firmaAdi:    "",
    telefon:     "",
    lisansNo:    "",
    sifre:       "",
    sifreTekrar: "",
  });
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata]             = useState("");
  const [basariliId, setBasariliId] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setHata("");

    if (form.sifre !== form.sifreTekrar) {
      setHata("Şifreler eşleşmiyor.");
      return;
    }
    if (form.sifre.length < 6) {
      setHata("Şifre en az 6 karakter olmalıdır.");
      return;
    }
    if (rol === "muteahhit" && !form.firmaAdi.trim()) {
      setHata("Müteahhit kaydı için firma adı zorunludur.");
      return;
    }

    setYukleniyor(true);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email:    form.email,
      password: form.sifre,
      options: {
        data: {
          ad_soyad:  form.adSoyad,
          firma_adi: form.firmaAdi || null,
          telefon:   form.telefon  || null,
          rol:       rol,
        },
      },
    });

    if (error) {
      setYukleniyor(false);
      setHata(ceviriHata(error.message));
      return;
    }

    // Müteahhit ise profil kaydı oluşturmayı dene
    if (rol === "muteahhit" && data.user) {
      try {
        await supabase.from("muteahhit_profiller").insert({
          kullanici_id:            data.user.id,
          firma_adi:               form.firmaAdi,
          lisans_no:               form.lisansNo || null,
          telefon:                 form.telefon  || null,
          email:                   form.email,
          uzmanlik_alanlari:       [],
          calistigi_iller:         [],
          tamamlanan_proje_sayisi: 0,
          kazanilan_ihale_sayisi:  0,
          aktif_ihale_sayisi:      0,
        });
      } catch {
        // Email doğrulaması gerektiren ortamlarda session henüz yok;
        // kullanıcı giriş yaptıktan sonra profil tamamlanabilir.
      }
      setBasariliId(data.user.id);
    } else {
      setBasariliId("arsa_sahibi");
    }

    setYukleniyor(false);
  }

  // ── Başarı ekranı ──────────────────────────────────────────
  if (basariliId) {
    const isMuteahhit = rol === "muteahhit" && basariliId !== "arsa_sahibi";
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Kayıt Başarılı!</h2>
            <p className="text-gray-500 mb-2">
              <span className="font-medium text-gray-700">{form.email}</span> adresine bir doğrulama bağlantısı gönderdik.
            </p>
            <p className="text-gray-400 text-sm mb-6">
              Bağlantıya tıkladıktan sonra giriş yapabilirsiniz.
            </p>
            {isMuteahhit && (
              <p className="text-sm text-blue-700 bg-blue-50 rounded-lg px-4 py-3 mb-6">
                Giriş yaptıktan sonra müteahhit profilinizi tamamlayabilirsiniz.
              </p>
            )}
            <Link
              href="/giris"
              className="inline-block bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg hover:bg-blue-800 transition-colors"
            >
              Giriş Yap
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Rol Seçimi ─────────────────────────────────────────────
  if (!rol) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Kayıt Ol</h1>
            <p className="text-gray-500 mt-2">Hesap türünüzü seçin</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Arsa Sahibi */}
            <button
              type="button"
              onClick={() => setRol("arsa_sahibi")}
              className="group flex flex-col items-center text-center gap-4 bg-white border-2 border-gray-200 rounded-2xl p-8 hover:border-blue-500 hover:shadow-md transition-all"
            >
              <div className="w-16 h-16 rounded-2xl bg-blue-50 group-hover:bg-blue-100 transition-colors flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 mb-1">Arsa Sahibi</p>
                <p className="text-sm text-gray-500 leading-relaxed">
                  İhale açın, müteahhit tekliflerini karşılaştırın, danışman atayın.
                </p>
              </div>
              <span className="text-sm text-blue-700 font-semibold group-hover:underline">
                Arsa Sahibi Olarak Kayıt →
              </span>
            </button>

            {/* Müteahhit */}
            <button
              type="button"
              onClick={() => setRol("muteahhit")}
              className="group flex flex-col items-center text-center gap-4 bg-white border-2 border-gray-200 rounded-2xl p-8 hover:border-orange-500 hover:shadow-md transition-all"
            >
              <div className="w-16 h-16 rounded-2xl bg-orange-50 group-hover:bg-orange-100 transition-colors flex items-center justify-center">
                <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 mb-1">Müteahhit</p>
                <p className="text-sm text-gray-500 leading-relaxed">
                  İhalelere teklif verin, profil oluşturun, referans projelerinizi sergileyin.
                </p>
              </div>
              <span className="text-sm text-orange-600 font-semibold group-hover:underline">
                Müteahhit Olarak Kayıt →
              </span>
            </button>
          </div>

          <p className="text-center text-sm text-gray-600 mt-8">
            Zaten hesabınız var mı?{" "}
            <Link href="/giris" className="text-blue-700 font-semibold hover:underline">
              Giriş Yapın
            </Link>
          </p>
        </div>
      </div>
    );
  }

  // ── Kayıt Formu ────────────────────────────────────────────
  const isMuteahhit = rol === "muteahhit";
  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <button
            type="button"
            onClick={() => { setRol(null); setHata(""); }}
            className="text-sm text-gray-400 hover:text-gray-700 mb-4 inline-flex items-center gap-1"
          >
            ← Geri
          </button>
          <div className={`inline-flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-full mb-3 ${
            isMuteahhit ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
          }`}>
            {isMuteahhit ? "Müteahhit Kaydı" : "Arsa Sahibi Kaydı"}
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Kayıt Ol</h1>
          <p className="text-gray-500 mt-2">Ücretsiz hesap oluşturun</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          {hata && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-6">
              {hata}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="adSoyad">
                  Ad Soyad <span className="text-red-500">*</span>
                </label>
                <input id="adSoyad" type="text" required
                  placeholder="Ahmet Yılmaz"
                  value={form.adSoyad}
                  onChange={(e) => setForm((f) => ({ ...f, adSoyad: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="telefon">
                  Telefon
                </label>
                <input id="telefon" type="tel"
                  placeholder="0532 123 45 67"
                  value={form.telefon}
                  onChange={(e) => setForm((f) => ({ ...f, telefon: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="firmaAdi">
                Firma Adı {isMuteahhit && <span className="text-red-500">*</span>}
              </label>
              <input id="firmaAdi" type="text"
                required={isMuteahhit}
                placeholder="ABC İnşaat Ltd. Şti."
                value={form.firmaAdi}
                onChange={(e) => setForm((f) => ({ ...f, firmaAdi: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            {isMuteahhit && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="lisansNo">
                  Yeterlik Belgesi No
                </label>
                <input id="lisansNo" type="text"
                  placeholder="YM-2024-XXXX"
                  value={form.lisansNo}
                  onChange={(e) => setForm((f) => ({ ...f, lisansNo: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="email">
                E-posta Adresi <span className="text-red-500">*</span>
              </label>
              <input id="email" type="email" required
                placeholder="ornek@firma.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="sifre">
                  Şifre <span className="text-red-500">*</span>
                </label>
                <input id="sifre" type="password" required
                  placeholder="Min. 6 karakter"
                  value={form.sifre}
                  onChange={(e) => setForm((f) => ({ ...f, sifre: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="sifreTekrar">
                  Şifre Tekrar <span className="text-red-500">*</span>
                </label>
                <input id="sifreTekrar" type="password" required
                  placeholder="••••••••"
                  value={form.sifreTekrar}
                  onChange={(e) => setForm((f) => ({ ...f, sifreTekrar: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>

            <p className="text-xs text-gray-500">
              Kayıt olarak{" "}
              <Link href="/kullanim-kosullari" className="text-blue-700 hover:underline">
                Kullanım Koşullarını
              </Link>{" "}
              ve{" "}
              <Link href="/gizlilik" className="text-blue-700 hover:underline">
                Gizlilik Politikasını
              </Link>{" "}
              kabul etmiş olursunuz.
            </p>

            <button type="submit" disabled={yukleniyor}
              className={`w-full text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                isMuteahhit
                  ? "bg-orange-600 hover:bg-orange-700"
                  : "bg-blue-700 hover:bg-blue-800"
              }`}>
              {yukleniyor ? "Kayıt oluşturuluyor…" : "Kayıt Ol"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-600 mt-6">
            Zaten hesabınız var mı?{" "}
            <Link href="/giris" className="text-blue-700 font-semibold hover:underline">
              Giriş Yapın
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
