"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { HesapTuru, YetkiBelgesiGrubu } from "@/lib/types";
import { YETKI_BELGESI_GRUPLARI } from "@/lib/muteahhit-yetki-belgesi";
import { GoogleIkon, AppleIkon, GozIkon, GozKapaliIkon } from "@/components/SosyalGirisIkonlari";

function ceviriHata(mesaj: string): string {
  if (mesaj.includes("User already registered") || mesaj.includes("already been registered"))
    return "Bu e-posta adresi zaten kayıtlı, lütfen giriş yapın.";
  if (mesaj.includes("Password should be"))
    return "Şifre en az 8 karakter olmalıdır.";
  if (mesaj.includes("Invalid email"))
    return "Geçerli bir e-posta adresi girin.";
  if (mesaj.includes("Network"))
    return "Bağlantı hatası. İnternet bağlantınızı kontrol edin.";
  return "Kayıt oluşturulamadı. Lütfen tekrar deneyin.";
}

function KayitForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/panel";
  const girisHref = `/giris${next !== "/panel" ? `?next=${encodeURIComponent(next)}` : ""}`;
  const [hesapTuru, setHesapTuru] = useState<HesapTuru | null>(null);
  const [form, setForm] = useState({
    adSoyad:     "",
    email:       "",
    firmaAdi:    "",
    telefon:     "",
    lisansNo:    "",
    yetkiBelgesiGrubu: "" as "" | YetkiBelgesiGrubu,
    davetKodu:   searchParams.get("ref") || "",
    sifre:       "",
    sifreTekrar: "",
  });
  const [kvkkOnay,          setKvkkOnay]          = useState(false);
  const [sifreGoster,       setSifreGoster]       = useState(false);
  const [sifreTekrarGoster, setSifreTekrarGoster] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata]             = useState("");
  const [basariliId, setBasariliId] = useState<string | null>(null);

  // Müteahhit'e özgü alanlar (firma adı, yetki belgesi) hem "muteahhit"
  // hem de "her_ikisi" hesap türünde gösterilir/zorunludur.
  const muteahhitAlanlariGerekli = hesapTuru === "muteahhit" || hesapTuru === "her_ikisi";

  async function handleOAuth(provider: "google" | "apple") {
    setHata("");
    const supabase = createClient();
    const params = new URLSearchParams({ next });
    if (hesapTuru) params.set("hesap_turu", hesapTuru);
    if (form.davetKodu.trim()) params.set("ref", form.davetKodu.trim().toUpperCase());

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?${params.toString()}` },
    });
    if (error) setHata(ceviriHata(error.message));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setHata("");

    if (form.sifre !== form.sifreTekrar) {
      setHata("Şifreler eşleşmiyor.");
      return;
    }
    if (form.sifre.length < 8) {
      setHata("Şifre en az 8 karakter olmalıdır.");
      return;
    }
    if (muteahhitAlanlariGerekli && !form.firmaAdi.trim()) {
      setHata("Müteahhit kaydı için firma adı zorunludur.");
      return;
    }
    if (muteahhitAlanlariGerekli && !form.yetkiBelgesiGrubu) {
      setHata("Müteahhit kaydı için Müteahhitlik Yetki Belgesi Grubu zorunludur.");
      return;
    }
    if (!kvkkOnay) {
      setHata("Devam etmek için Kullanım Koşulları ve Gizlilik Politikasını (KVKK) onaylamalısınız.");
      return;
    }

    setYukleniyor(true);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email:    form.email,
      password: form.sifre,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        data: {
          ad_soyad:  form.adSoyad,
          firma_adi: form.firmaAdi || null,
          telefon:   form.telefon  || null,
          hesap_turu: hesapTuru,
          davet_referans_kodu: form.davetKodu.trim() ? form.davetKodu.trim().toUpperCase() : null,
        },
      },
    });

    if (error) {
      console.error("Kayıt hatası (tam obje):", error);
      console.log("Kayıt hatası — error.message:", error.message, "| status:", error.status);
      setYukleniyor(false);
      const gercekMesaj = error.message && error.message.trim() && error.message !== "{}"
        ? error.message
        : `bilinmeyen hata${error.status ? ` — HTTP ${error.status}` : ""}`;
      setHata(`${ceviriHata(error.message)} (${gercekMesaj})`);
      return;
    }

    // Supabase, e-posta enumeration'ı önlemek için zaten kayıtlı ve
    // onaylanmış bir e-postayla tekrar signUp çağrılırsa hata DÖNMEZ —
    // bunun yerine identities dizisi boş gelir (data.session da null
    // olur). Bu, kullanıcıya "kayıt başarılı, e-postanı onayla" gibi
    // yanlış bir mesaj göstermemek için burada ayrıca kontrol edilir.
    if (data.user && data.user.identities?.length === 0) {
      setYukleniyor(false);
      setHata("Bu e-posta adresi zaten kayıtlı, lütfen giriş yapın.");
      return;
    }

    console.log("signUp başarılı — user:", data.user?.id, "session:", !!data.session, "email_confirmed_at:", data.user?.email_confirmed_at);

    // Email doğrulaması kapalıysa session hemen döner → doğrudan hedefe yönlendir
    if (data.session) {
      router.push(next);
      router.refresh();
      return;
    }

    // Müteahhit ya da Her İkisi ise profil kaydı oluşturmayı dene
    if (muteahhitAlanlariGerekli && data.user) {
      try {
        await supabase.from("muteahhit_profiller").insert({
          kullanici_id:            data.user.id,
          firma_adi:               form.firmaAdi,
          lisans_no:               form.lisansNo || null,
          yetki_belgesi_grubu:     form.yetkiBelgesiGrubu || null,
          telefon:                 form.telefon  || null,
          email:                   form.email,
          uzmanlik_alanlari:       [],
          calistigi_iller:         [],
          tamamlanan_proje_sayisi: 0,
          kazanilan_ihale_sayisi:  0,
          aktif_ihale_sayisi:      0,
        });
      } catch (profileErr) {
        console.warn("Müteahhit profili oluşturulamadı (email doğrulama sonrası denenebilir):", profileErr);
      }
      setBasariliId(data.user.id);
    } else {
      setBasariliId(data.user?.id ?? "kayit-tamam");
    }

    setYukleniyor(false);
  }

  // ── Başarı ekranı ──────────────────────────────────────────
  if (basariliId) {
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
            <p className="text-gray-400 text-sm mb-1">
              Bağlantıya tıkladıktan sonra giriş yapabilirsiniz.
            </p>
            <p className="text-gray-400 text-xs mb-6">
              Mail gelmiyorsa spam / gereksiz posta klasörünüzü kontrol edin.
            </p>
            {muteahhitAlanlariGerekli && (
              <p className="text-sm text-blue-700 bg-blue-50 rounded-lg px-4 py-3 mb-6">
                Giriş yaptıktan sonra müteahhit profilinizi tamamlayabilirsiniz.
              </p>
            )}
            <Link
              href={girisHref}
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
  if (!hesapTuru) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-3xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Kayıt Ol</h1>
            <p className="text-gray-500 mt-2">Hesap türünüzü seçin</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {/* Arsa Sahibi */}
            <button
              type="button"
              onClick={() => setHesapTuru("arsa_sahibi")}
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
                  İhale açın, müteahhit tekliflerini karşılaştırın, destek uzmanı atayın.
                </p>
              </div>
              <span className="text-sm text-blue-700 font-semibold group-hover:underline">
                Arsa Sahibi Olarak Kayıt →
              </span>
            </button>

            {/* Müteahhit */}
            <button
              type="button"
              onClick={() => setHesapTuru("muteahhit")}
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

            {/* Her İkisi */}
            <button
              type="button"
              onClick={() => setHesapTuru("her_ikisi")}
              className="group flex flex-col items-center text-center gap-4 bg-white border-2 border-gray-200 rounded-2xl p-8 hover:border-purple-500 hover:shadow-md transition-all"
            >
              <div className="w-16 h-16 rounded-2xl bg-purple-50 group-hover:bg-purple-100 transition-colors flex items-center justify-center">
                <svg className="w-8 h-8 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m5-4a4 4 0 100-8 4 4 0 000 8zm6 3.13a4 4 0 010 7.75M7 12.13a4 4 0 000 7.75" />
                </svg>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 mb-1">Her İkisi</p>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Hem arsa sahibi olarak ihale açın hem müteahhit olarak tekliflere katılın.
                </p>
              </div>
              <span className="text-sm text-purple-700 font-semibold group-hover:underline">
                Her İkisi Olarak Kayıt →
              </span>
            </button>
          </div>

          <p className="text-center text-sm text-gray-600 mt-8">
            Zaten hesabınız var mı?{" "}
            <Link href={girisHref} className="text-blue-700 font-semibold hover:underline">
              Giriş Yapın
            </Link>
          </p>
        </div>
      </div>
    );
  }

  // ── Kayıt Formu ────────────────────────────────────────────
  const isMuteahhit = muteahhitAlanlariGerekli;
  const rozetEtiket = hesapTuru === "muteahhit" ? "Müteahhit Kaydı" : hesapTuru === "her_ikisi" ? "Her İkisi Kaydı" : "Arsa Sahibi Kaydı";
  const rozetCls = hesapTuru === "muteahhit" ? "bg-orange-100 text-orange-700" : hesapTuru === "her_ikisi" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700";
  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <button
            type="button"
            onClick={() => { setHesapTuru(null); setHata(""); }}
            className="text-sm text-gray-400 hover:text-gray-700 mb-4 inline-flex items-center gap-1"
          >
            ← Geri
          </button>
          <div className={`inline-flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-full mb-3 ${rozetCls}`}>
            {rozetEtiket}
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

          {/* ─── Sosyal Giriş ─── */}
          <div className="flex flex-col gap-3 mb-6">
            <button
              type="button"
              onClick={() => handleOAuth("google")}
              className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-lg py-2.5 font-semibold text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <GoogleIkon /> Google ile devam et
            </button>
            <button
              type="button"
              onClick={() => handleOAuth("apple")}
              className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-lg py-2.5 font-semibold text-sm text-gray-700 hover:bg-gray-50 transition-colors bg-black text-white hover:bg-gray-900"
            >
              <AppleIkon /> Apple ile devam et
            </button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-4 text-sm text-gray-400">veya e-posta ile kayıt ol</span>
            </div>
          </div>

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

            {isMuteahhit && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="yetkiBelgesiGrubu">
                  Müteahhitlik Yetki Belgesi Grubu <span className="text-red-500">*</span>
                </label>
                <select id="yetkiBelgesiGrubu" required
                  value={form.yetkiBelgesiGrubu}
                  onChange={(e) => setForm((f) => ({ ...f, yetkiBelgesiGrubu: e.target.value as YetkiBelgesiGrubu }))}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">Grup seçin...</option>
                  {YETKI_BELGESI_GRUPLARI.map((g) => (
                    <option key={g} value={g}>{g === "Geçici/Y Belgesi" ? g : `${g} Grubu`}</option>
                  ))}
                </select>
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="davetKodu">
                Davet Kodu <span className="text-gray-400 font-normal">(opsiyonel)</span>
              </label>
              <input id="davetKodu" type="text"
                placeholder="ABC123"
                value={form.davetKodu}
                onChange={(e) => setForm((f) => ({ ...f, davetKodu: e.target.value.toUpperCase() }))}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm uppercase"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="sifre">
                  Şifre <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input id="sifre" type={sifreGoster ? "text" : "password"} required
                    placeholder="Min. 8 karakter"
                    value={form.sifre}
                    onChange={(e) => setForm((f) => ({ ...f, sifre: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg pl-4 pr-10 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <button type="button" onClick={() => setSifreGoster((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={sifreGoster ? "Şifreyi gizle" : "Şifreyi göster"}
                  >
                    {sifreGoster ? <GozKapaliIkon className="w-4.5 h-4.5" /> : <GozIkon className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="sifreTekrar">
                  Şifre Tekrar <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input id="sifreTekrar" type={sifreTekrarGoster ? "text" : "password"} required
                    placeholder="••••••••"
                    value={form.sifreTekrar}
                    onChange={(e) => setForm((f) => ({ ...f, sifreTekrar: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg pl-4 pr-10 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <button type="button" onClick={() => setSifreTekrarGoster((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={sifreTekrarGoster ? "Şifreyi gizle" : "Şifreyi göster"}
                  >
                    {sifreTekrarGoster ? <GozKapaliIkon className="w-4.5 h-4.5" /> : <GozIkon className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>
            </div>

            <label className="flex items-start gap-2.5 text-xs text-gray-500 cursor-pointer">
              <input type="checkbox" required
                checked={kvkkOnay}
                onChange={(e) => setKvkkOnay(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-700 focus:ring-blue-500"
              />
              <span>
                <Link href="/kullanim-kosullari" className="text-blue-700 hover:underline">
                  Kullanım Koşullarını
                </Link>{" "}
                ve{" "}
                <Link href="/gizlilik" className="text-blue-700 hover:underline">
                  Gizlilik Politikasını (KVKK)
                </Link>{" "}
                okudum, kabul ediyorum. <span className="text-red-500">*</span>
              </span>
            </label>

            <button type="submit" disabled={yukleniyor}
              className={`w-full text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                hesapTuru === "muteahhit"
                  ? "bg-orange-600 hover:bg-orange-700"
                  : hesapTuru === "her_ikisi"
                  ? "bg-purple-700 hover:bg-purple-800"
                  : "bg-blue-700 hover:bg-blue-800"
              }`}>
              {yukleniyor ? "Kayıt oluşturuluyor…" : "Kayıt Ol"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-600 mt-6">
            Zaten hesabınız var mı?{" "}
            <Link href={girisHref} className="text-blue-700 font-semibold hover:underline">
              Giriş Yapın
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function KayitSayfasi() {
  return (
    <Suspense fallback={<div className="min-h-[calc(100vh-8rem)]" />}>
      <KayitForm />
    </Suspense>
  );
}
