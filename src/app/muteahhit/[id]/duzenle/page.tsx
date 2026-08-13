"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { mockMuteahhitler, mockReferansProjeler } from "@/lib/mock-data";
import type { MuteahhitProfil, ReferansProje, InsaatTuru } from "@/lib/types";
import { YETKI_BELGESI_GRUPLARI, YETKI_BELGESI_ACIKLAMA } from "@/lib/muteahhit-yetki-belgesi";

const UZMANLIK_SECENEKLERI: InsaatTuru[] = [
  "Kentsel Dönüşüm",
  "Kat Karşılığı",
  "Yapı İnşaat",
  "Bakım & Onarım",
];

const IL_LISTESI = [
  "Adana", "Ankara", "Antalya", "Aydın", "Balıkesir", "Bursa",
  "Denizli", "Diyarbakır", "Eskişehir", "Gaziantep", "Hatay",
  "İstanbul", "İzmir", "Kayseri", "Kocaeli", "Konya", "Malatya",
  "Manisa", "Mersin", "Muğla", "Sakarya", "Samsun", "Trabzon", "Şanlıurfa",
];

type YeniProje = Omit<ReferansProje, "id" | "muteahhit_id" | "created_at">;

const BOŞ_PROJE: YeniProje = {
  proje_adi: "",
  konum: "",
  yil: new Date().getFullYear(),
  tur: "Yapı İnşaat",
  aciklama: "",
};

export default function MuteahhitDuzenle() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [yukleniyor, setYukleniyor] = useState(true);
  const [yetkisiz, setYetkisiz] = useState(false);
  const [kaydediyor, setKaydediyor] = useState(false);
  const [basarili, setBasarili] = useState(false);
  const [hata, setHata] = useState("");

  const [form, setForm] = useState<Partial<MuteahhitProfil>>({});
  const [projeler, setProjeler] = useState<ReferansProje[]>([]);
  const [yeniProje, setYeniProje] = useState<YeniProje>(BOŞ_PROJE);
  const [projeFormuAcik, setProjeFormuAcik] = useState(false);

  useEffect(() => {
    async function yukle() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push(`/giris?redirect=/muteahhit/${id}/duzenle`);
        return;
      }

      // Profil çek
      let profil: MuteahhitProfil | null = null;
      try {
        const { data } = await supabase
          .from("muteahhit_profiller")
          .select("*")
          .eq("kullanici_id", id)
          .single();
        if (data) profil = data as MuteahhitProfil;
      } catch { /* */ }

      if (!profil) {
        profil = mockMuteahhitler.find((m) => m.id === id) ?? null;
      }

      if (!profil) { router.push("/"); return; }

      // Sahiplik kontrolü (mock modda atla) — sahibi ya da admin degilse erisim yok.
      if (profil.kullanici_id !== "m1" && profil.kullanici_id !== "m2" && profil.kullanici_id !== "m3") {
        if (session.user.id !== profil.kullanici_id) {
          const { data: oturumKullanici } = await supabase
            .from("kullanicilar")
            .select("rol")
            .eq("id", session.user.id)
            .maybeSingle();
          if (oturumKullanici?.rol !== "admin") {
            setYetkisiz(true);
            setYukleniyor(false);
            return;
          }
        }
      }

      setForm(profil);

      // Referans projeleri çek
      try {
        const { data: pData } = await supabase
          .from("muteahhit_referans_projeler")
          .select("*")
          .eq("muteahhit_id", id)
          .order("yil", { ascending: false });
        if (pData && pData.length > 0) {
          setProjeler(pData as ReferansProje[]);
        } else {
          setProjeler(mockReferansProjeler.filter((p) => p.muteahhit_id === id));
        }
      } catch {
        setProjeler(mockReferansProjeler.filter((p) => p.muteahhit_id === id));
      }

      setYukleniyor(false);
    }
    yukle();
  }, [id, router]);

  function toggleUzmanlik(tur: InsaatTuru) {
    setForm((prev) => {
      const mevcut = prev.uzmanlik_alanlari ?? [];
      return {
        ...prev,
        uzmanlik_alanlari: mevcut.includes(tur)
          ? mevcut.filter((u) => u !== tur)
          : [...mevcut, tur],
      };
    });
  }

  function toggleIl(il: string) {
    setForm((prev) => {
      const mevcut = prev.calistigi_iller ?? [];
      return {
        ...prev,
        calistigi_iller: mevcut.includes(il)
          ? mevcut.filter((i) => i !== il)
          : [...mevcut, il],
      };
    });
  }

  async function handleKaydet(e: React.FormEvent) {
    e.preventDefault();
    setHata("");

    if (!form.firma_adi?.trim()) { setHata("Firma adı zorunludur."); return; }
    if (!form.uzmanlik_alanlari?.length) { setHata("En az bir uzmanlık alanı seçin."); return; }
    if (!form.calistigi_iller?.length) { setHata("En az bir il seçin."); return; }

    setKaydediyor(true);

    const supabase = createClient();
    try {
      const { error } = await supabase
        .from("muteahhit_profiller")
        .upsert({
          kullanici_id: id,
          firma_adi: form.firma_adi,
          kurulus_yili: form.kurulus_yili,
          calistigi_iller: form.calistigi_iller,
          uzmanlik_alanlari: form.uzmanlik_alanlari,
          lisans_no: form.lisans_no,
          sicil_no: form.sicil_no,
          yetki_belgesi_grubu: form.yetki_belgesi_grubu,
          telefon: form.telefon,
          email: form.email,
          aciklama: form.aciklama,
          sertifika_bilgisi: form.sertifika_bilgisi,
        }, { onConflict: "kullanici_id" });
      if (error) throw error;
    } catch {
      // mock modda hata görmezden gel
    }

    setKaydediyor(false);
    setBasarili(true);
    setTimeout(() => {
      setBasarili(false);
      router.push(`/muteahhit/${id}`);
    }, 1500);
  }

  async function handleProjeEkle() {
    if (!yeniProje.proje_adi.trim() || !yeniProje.konum.trim()) {
      setHata("Proje adı ve konumu zorunludur.");
      return;
    }

    const supabase = createClient();
    const yeniKayit: ReferansProje = {
      ...yeniProje,
      id: `rp-${Date.now()}`,
      muteahhit_id: id,
      created_at: new Date().toISOString(),
    };

    try {
      await supabase.from("muteahhit_referans_projeler").insert({
        ...yeniProje,
        muteahhit_id: id,
      });
    } catch { /* mock modda devam */ }

    setProjeler((prev) => [yeniKayit, ...prev]);
    setYeniProje(BOŞ_PROJE);
    setProjeFormuAcik(false);
    setHata("");
  }

  async function handleProjeSil(projeId: string) {
    const supabase = createClient();
    try {
      await supabase.from("muteahhit_referans_projeler").delete().eq("id", projeId);
    } catch { /* mock modda devam */ }
    setProjeler((prev) => prev.filter((p) => p.id !== projeId));
  }

  if (yukleniyor) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (yetkisiz) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <p className="text-gray-500 mb-4">Bu profili düzenleme yetkiniz yok.</p>
        <Link href={`/muteahhit/${id}`} className="text-blue-700 font-semibold hover:underline">
          Profile Dön
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-8">
        <Link href="/" className="hover:text-blue-700">Ana Sayfa</Link>
        <span>/</span>
        <Link href={`/muteahhit/${id}`} className="hover:text-blue-700">{form.firma_adi}</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Profili Düzenle</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900 mb-8">Profili Düzenle</h1>

      {basarili && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-5 py-3 mb-6">
          Profil başarıyla kaydedildi. Yönlendiriliyorsunuz…
        </div>
      )}

      {hata && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-5 py-3 mb-6">
          {hata}
        </div>
      )}

      <form onSubmit={handleKaydet} className="flex flex-col gap-6">

        {/* Temel Bilgiler */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-5">Temel Bilgiler</h2>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Firma Adı <span className="text-red-500">*</span>
              </label>
              <input type="text" required
                value={form.firma_adi ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, firma_adi: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Kuruluş Yılı</label>
                <input type="number" min={1950} max={new Date().getFullYear()}
                  value={form.kurulus_yili ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, kurulus_yili: Number(e.target.value) || undefined }))}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Yeterlik Belgesi No</label>
                <input type="text"
                  value={form.lisans_no ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, lisans_no: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Sicil No</label>
                <input type="text"
                  value={form.sicil_no ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, sicil_no: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Telefon</label>
                <input type="tel"
                  value={form.telefon ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, telefon: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label
                className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5"
                title="Bakanlık, gruplara göre üstlenilebilecek iş deneyimi ve azami iş bedelini sınırlandırır."
              >
                Müteahhitlik Yetki Belgesi Grubu
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </label>
              <select
                value={form.yetki_belgesi_grubu ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, yetki_belgesi_grubu: (e.target.value || undefined) as MuteahhitProfil["yetki_belgesi_grubu"] }))}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Grup seçin...</option>
                {YETKI_BELGESI_GRUPLARI.map((g) => (
                  <option key={g} value={g} title={YETKI_BELGESI_ACIKLAMA[g]}>
                    {g === "Geçici/Y Belgesi" ? g : `${g} Grubu`}
                  </option>
                ))}
              </select>
              {form.yetki_belgesi_grubu && YETKI_BELGESI_ACIKLAMA[form.yetki_belgesi_grubu] && (
                <p className="text-xs text-gray-400 mt-1.5">{YETKI_BELGESI_ACIKLAMA[form.yetki_belgesi_grubu]}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">E-posta</label>
              <input type="email"
                value={form.email ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Firma Hakkında</label>
              <textarea rows={4}
                value={form.aciklama ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, aciklama: e.target.value }))}
                placeholder="Firmanızı tanıtın, deneyimlerinizden bahsedin…"
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Uzmanlık Alanları */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Uzmanlık Alanları <span className="text-red-500">*</span></h2>
          <p className="text-xs text-gray-400 mb-4">En az bir seçin</p>
          <div className="grid grid-cols-2 gap-3">
            {UZMANLIK_SECENEKLERI.map((tur) => {
              const secili = form.uzmanlik_alanlari?.includes(tur) ?? false;
              return (
                <button key={tur} type="button" onClick={() => toggleUzmanlik(tur)}
                  className={`text-sm font-medium px-4 py-3 rounded-xl border text-left transition-colors ${
                    secili
                      ? "bg-blue-700 border-blue-700 text-white"
                      : "bg-white border-gray-200 text-gray-700 hover:border-blue-300"
                  }`}>
                  {tur}
                </button>
              );
            })}
          </div>
        </div>

        {/* Çalıştığı İller */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Çalıştığı İller <span className="text-red-500">*</span></h2>
          <p className="text-xs text-gray-400 mb-4">Hizmet verdiğiniz illeri seçin</p>
          <div className="flex flex-wrap gap-2">
            {IL_LISTESI.map((il) => {
              const secili = form.calistigi_iller?.includes(il) ?? false;
              return (
                <button key={il} type="button" onClick={() => toggleIl(il)}
                  className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                    secili
                      ? "bg-blue-700 border-blue-700 text-white font-semibold"
                      : "bg-white border-gray-200 text-gray-600 hover:border-blue-300"
                  }`}>
                  {il}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sertifika Bilgisi */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Belgeler & Sertifikalar</h2>
          <p className="text-xs text-gray-400 mb-4">Her belgeyi "·" (nokta) ile ayırın. Örn: ISO 9001 · TSE Belgesi</p>
          <textarea rows={3}
            value={form.sertifika_bilgisi ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, sertifika_bilgisi: e.target.value }))}
            placeholder="ISO 9001:2015 · Müteahhitlik Yeterlik Belgesi A Sınıfı · OHSAS 18001"
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Kaydet */}
        <div className="flex items-center justify-end gap-3">
          <Link href={`/muteahhit/${id}`}
            className="px-5 py-2.5 text-sm text-gray-700 font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            İptal
          </Link>
          <button type="submit" disabled={kaydediyor}
            className="px-6 py-2.5 text-sm bg-blue-700 text-white font-semibold rounded-xl hover:bg-blue-800 transition-colors disabled:opacity-60">
            {kaydediyor ? "Kaydediliyor…" : "Değişiklikleri Kaydet"}
          </button>
        </div>
      </form>

      {/* Referans Projeler */}
      <div className="mt-8 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Referans Projeler</h2>
            <p className="text-xs text-gray-400 mt-0.5">Tamamladığınız projeleri ekleyin</p>
          </div>
          <button type="button"
            onClick={() => { setProjeFormuAcik(!projeFormuAcik); setHata(""); }}
            className="text-sm bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-800 transition-colors">
            + Proje Ekle
          </button>
        </div>

        {projeFormuAcik && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5">
            <p className="text-sm font-semibold text-gray-900 mb-3">Yeni Proje</p>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Proje Adı *</label>
                  <input type="text"
                    value={yeniProje.proje_adi}
                    onChange={(e) => setYeniProje((p) => ({ ...p, proje_adi: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Konum *</label>
                  <input type="text" placeholder="İstanbul / Kadıköy"
                    value={yeniProje.konum}
                    onChange={(e) => setYeniProje((p) => ({ ...p, konum: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Yıl</label>
                  <input type="number" min={1980} max={new Date().getFullYear()}
                    value={yeniProje.yil}
                    onChange={(e) => setYeniProje((p) => ({ ...p, yil: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tür</label>
                  <select
                    value={yeniProje.tur}
                    onChange={(e) => setYeniProje((p) => ({ ...p, tur: e.target.value as InsaatTuru }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {UZMANLIK_SECENEKLERI.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Kısa Açıklama</label>
                <input type="text"
                  value={yeniProje.aciklama ?? ""}
                  onChange={(e) => setYeniProje((p) => ({ ...p, aciklama: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setProjeFormuAcik(false)}
                  className="text-sm px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                  İptal
                </button>
                <button type="button" onClick={handleProjeEkle}
                  className="text-sm px-4 py-2 bg-blue-700 text-white font-semibold rounded-lg hover:bg-blue-800">
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        )}

        {projeler.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            Henüz referans proje eklenmedi.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {projeler.map((proje) => (
              <div key={proje.id}
                className="flex items-start justify-between gap-3 border border-gray-100 rounded-xl p-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{proje.proje_adi}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {proje.konum} · {proje.yil} · {proje.tur}
                  </p>
                  {proje.aciklama && (
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">{proje.aciklama}</p>
                  )}
                </div>
                <button type="button" onClick={() => handleProjeSil(proje.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0 p-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
