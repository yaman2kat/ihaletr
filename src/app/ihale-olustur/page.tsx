"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import DosyaAlani from "@/components/DosyaAlani";
import SozlesmeModal from "@/components/SozlesmeModal";
import { PLAN_MAKS_IHALE_GUNU } from "@/lib/plan-limitleri";
import type { PlanTuru } from "@/lib/types";

const TASLAK_ANAHTARI = "ihale-olustur-taslak";

const KATEGORILER = ["Kentsel Dönüşüm", "Kat Karşılığı", "Yapı İnşaat", "Bakım & Onarım"];

const ILLER = [
  "Adana","Ankara","Antalya","Aydın","Balıkesir","Bursa","Diyarbakır",
  "Erzurum","Eskişehir","Gaziantep","Hatay","İstanbul","İzmir",
  "Kayseri","Kocaeli","Konya","Malatya","Mersin","Muğla",
  "Samsun","Sakarya","Şanlıurfa","Trabzon","Van",
];

function maxBitisTarihi(planTuru: string): string {
  const maxGun = PLAN_MAKS_IHALE_GUNU[planTuru as PlanTuru] ?? PLAN_MAKS_IHALE_GUNU.ucretsiz;
  const d = new Date();
  d.setDate(d.getDate() + maxGun);
  return d.toISOString().split("T")[0];
}

export default function IhaleOlustur() {
  const router = useRouter();
  const [planTuru, setPlanTuru] = useState<string>("ucretsiz");
  const [form, setForm] = useState({
    baslik: "", kategori: "", aciklama: "",
    kurum: "", sehir: "", ilce: "", mahalle: "", adaNo: "", parselNo: "", yuzolcumuM2: "",
    baslangicFiyati: "", bitisTarihi: "",
    yapiInsaatRuhsati: "" as "" | "var" | "yok",
    proje: "" as "" | "var" | "yok",
  });
  const [eksikAlanlar, setEksikAlanlar] = useState<string[]>([]);
  const [otomatikSonlandirmaOnay, setOtomatikSonlandirmaOnay] = useState(false);
  const [adaParselBildirim, setAdaParselBildirim] = useState(false);
  const [kullaniciAdSoyad, setKullaniciAdSoyad] = useState("");
  const [sozlesmeModalAcik, setSozlesmeModalAcik] = useState(false);
  const [dosyalar, setDosyalar] = useState<{
    sartname: File | null;
    sozlesme: File | null;
    proje: File | null;
    tapu: File | null;
  }>({ sartname: null, sozlesme: null, proje: null, tapu: null });
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState("");
  const taslakYuklendiRef = useRef(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return;
      const { data } = await supabase
        .from("kullanicilar")
        .select("plan_turu, ad_soyad")
        .eq("id", session.user.id)
        .single();
      if (data?.plan_turu) setPlanTuru(data.plan_turu);
      if (data?.ad_soyad) setKullaniciAdSoyad(data.ad_soyad);
    });
  }, []);

  // Sayfa açılışında yarım kalan taslağı geri yükle (kayıt/giriş sonrası dönüşte de çalışır)
  useEffect(() => {
    try {
      const kayitli = sessionStorage.getItem(TASLAK_ANAHTARI);
      if (kayitli) setForm(JSON.parse(kayitli));
    } catch { /* noop */ }
    taslakYuklendiRef.current = true;
  }, []);

  useEffect(() => {
    if (!taslakYuklendiRef.current) return;
    try { sessionStorage.setItem(TASLAK_ANAHTARI, JSON.stringify(form)); } catch { /* noop */ }
  }, [form]);

  function dogrula(): string[] {
    const eksik: string[] = [];
    if (!form.baslik.trim())          eksik.push("İhale Başlığı");
    if (!form.kategori)               eksik.push("Kategori");
    if (!form.aciklama.trim())        eksik.push("Açıklama");
    if (!form.kurum.trim())           eksik.push("Kurum / Firma");
    if (!form.sehir)                  eksik.push("Şehir");
    if (!form.baslangicFiyati)        eksik.push("Başlangıç Fiyatı");
    if (!form.bitisTarihi)            eksik.push("Son Teklif Tarihi");
    if (!form.yapiInsaatRuhsati)      eksik.push("Yapı İnşaat Ruhsatı");
    if (!form.proje)                  eksik.push("Proje");
    if (!dosyalar.sartname)           eksik.push("Yapı Şartnamesi");
    if (form.proje === "var" && !dosyalar.proje) eksik.push("Bina Projesi (Proje Var seçildi)");
    if (planTuru === "ucretsiz" && !otomatikSonlandirmaOnay) eksik.push("Otomatik sonlandırma onayı");
    return eksik;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setHata("");
    setEksikAlanlar([]);

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    // GEÇİCİ: İhale yayınlamak için giriş/kayıt zorunluluğu kaldırıldı.
    // Tekrar zorunlu kılmak için aşağıdaki bloğun yorumunu kaldırın:
    // if (!session?.user) {
    //   router.push(`/kayit?next=${encodeURIComponent("/ihale-olustur")}`);
    //   return;
    // }
    const kullaniciId = session?.user?.id ?? null;

    const eksik = dogrula();
    if (eksik.length > 0) {
      setEksikAlanlar(eksik);
      return;
    }

    setYukleniyor(true);

    // 1. İhaleyi kaydet
    const { data: ihaleData, error: ihaleError } = await supabase
      .from("ihaleler")
      .insert({
        baslik:           form.baslik,
        kategori:         form.kategori,
        aciklama:         form.aciklama,
        kurum:            form.kurum,
        sehir:            form.sehir,
        ilce:             form.ilce   || null,
        mahalle:          form.mahalle || null,
        ada_no:           form.adaNo  || null,
        parsel_no:        form.parselNo || null,
        yuzolcumu_m2:     form.yuzolcumuM2 ? Number(form.yuzolcumuM2) : null,
        baslangic_fiyati: Number(form.baslangicFiyati),
        baslangic_tarihi: new Date().toISOString().split("T")[0],
        bitis_tarihi:           form.bitisTarihi,
        durum:                  "beklemede",
        yapi_insaat_ruhsati:    form.yapiInsaatRuhsati || null,
        proje:                  form.proje || null,
        olusturan_id:           kullaniciId,
      })
      .select("id")
      .single();

    if (ihaleError || !ihaleData) {
      setHata("İhale oluşturulamadı: " + (ihaleError?.message ?? "Bilinmeyen hata"));
      setYukleniyor(false);
      return;
    }

    // 2. Dosyaları Storage'a yükle ve belgeler tablosuna kaydet
    const dosyaYukle = async (
      dosya: File | null,
      tur: "proje" | "sozlesme" | "ruhsat" | "diger",
      baslik: string
    ) => {
      if (!dosya) return;
      const yol = `${ihaleData.id}/${tur}-${Date.now()}-${dosya.name}`;
      const { data: storageData, error: storageError } = await supabase.storage
        .from("ihale-belgeleri")
        .upload(yol, dosya, { upsert: false });

      if (storageError || !storageData) return;

      const { data: urlData } = supabase.storage
        .from("ihale-belgeleri")
        .getPublicUrl(yol);

      await supabase.from("belgeler").insert({
        baslik,
        dosya_url:   urlData.publicUrl,
        dosya_tipi:  dosya.type,
        boyut:       dosya.size,
        tur,
        ihale_id:    ihaleData.id,
        yukleyen_id: kullaniciId,
      });
    };

    await Promise.allSettled([
      dosyaYukle(dosyalar.sartname, "proje",   "Yapı Şartnamesi"),
      dosyaYukle(dosyalar.sozlesme, "sozlesme", "Sözleşme Tasarısı"),
      dosyaYukle(dosyalar.proje,    "proje",    "Bina Projesi"),
      dosyaYukle(dosyalar.tapu,     "ruhsat",   "Tapu Fotokopisi"),
    ]);

    setYukleniyor(false);
    try { sessionStorage.removeItem(TASLAK_ANAHTARI); } catch { /* noop */ }
    router.push("/ihaleler");
    router.refresh();
  }

  function guncelle(alan: string, deger: string) {
    setForm((f) => ({ ...f, [alan]: deger }));
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-8">
        <Link href="/" className="hover:text-blue-700">Ana Sayfa</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">İhale Oluştur</span>
      </nav>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Yeni İhale Oluştur</h1>
        <p className="text-gray-500 text-sm mb-4">Tüm alanları eksiksiz doldurun.</p>

        {planTuru === "ucretsiz" && (
          <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6">
            <div className="flex items-center gap-2 text-sm text-amber-800">
              <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Ücretsiz planda maksimum ihale süresi <strong>5 gün</strong>.</span>
            </div>
            <a href="/premium" className="text-xs font-bold text-amber-700 hover:text-amber-900 whitespace-nowrap underline">
              Premium'a Geç →
            </a>
          </div>
        )}

        {hata && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-6">{hata}</div>
        )}

        {eksikAlanlar.length > 0 && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-4 mb-6">
            <p className="font-semibold mb-2">Lütfen aşağıdaki alanları doldurun:</p>
            <ul className="list-disc list-inside flex flex-col gap-1">
              {eksikAlanlar.map((alan) => (
                <li key={alan}>{alan}</li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              İhale Başlığı <span className="text-red-500">*</span>
            </label>
            <input
              type="text" required placeholder="Örn: Kadıköy Sosyal Konut Projesi"
              value={form.baslik} onChange={(e) => guncelle("baslik", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Kategori <span className="text-red-500">*</span>
            </label>
            <select
              required value={form.kategori} onChange={(e) => guncelle("kategori", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Kategori seçin...</option>
              {KATEGORILER.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Açıklama <span className="text-red-500">*</span>
            </label>
            <textarea
              required rows={4} placeholder="İhale kapsamını, teknik şartları ve beklentileri açıklayın..."
              value={form.aciklama} onChange={(e) => guncelle("aciklama", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Kurum / Firma <span className="text-red-500">*</span>
              </label>
              <input
                type="text" required placeholder="ABC Belediyesi"
                value={form.kurum} onChange={(e) => guncelle("kurum", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Şehir <span className="text-red-500">*</span>
              </label>
              <select
                required value={form.sehir} onChange={(e) => guncelle("sehir", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">İl seçin...</option>
                {ILLER.map((il) => <option key={il} value={il}>{il}</option>)}
              </select>
            </div>
          </div>

          {/* Tapu / Parsel Bilgileri */}
          <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
            <p className="text-sm font-semibold text-gray-700 mb-3">Tapu / Parsel Bilgileri</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">İlçe</label>
                <input
                  type="text" placeholder="Örn: Kadıköy"
                  value={form.ilce} onChange={(e) => guncelle("ilce", e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Mahalle</label>
                <input
                  type="text" placeholder="Örn: Caferağa"
                  value={form.mahalle} onChange={(e) => guncelle("mahalle", e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Yüzölçümü (m²)</label>
                <input
                  type="number" min="0" placeholder="Örn: 1200"
                  value={form.yuzolcumuM2} onChange={(e) => guncelle("yuzolcumuM2", e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Ada No</label>
                <input
                  type="text" placeholder="Örn: 2841"
                  value={form.adaNo} onChange={(e) => guncelle("adaNo", e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Parsel No</label>
                <input
                  type="text" placeholder="Örn: 14"
                  value={form.parselNo} onChange={(e) => guncelle("parselNo", e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                />
              </div>
            </div>

            {adaParselBildirim && (
              <div className="fixed top-16 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
                <div className="pointer-events-auto flex items-center gap-3 bg-green-600 text-white text-sm px-5 py-3 rounded-xl shadow-lg max-w-lg w-full">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="flex-1">Ada-parsel bilgileri panoya kopyalandı, TKGM sayfasına yapıştırın.</span>
                  <button onClick={() => setAdaParselBildirim(false)} className="hover:text-green-200">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={async () => {
                const satirlar = [
                  form.sehir   ? `İl: ${form.sehir}`         : null,
                  form.ilce    ? `İlçe: ${form.ilce}`         : null,
                  form.adaNo   ? `Ada No: ${form.adaNo}`      : null,
                  form.parselNo ? `Parsel No: ${form.parselNo}` : null,
                ].filter(Boolean) as string[];
                try { await navigator.clipboard.writeText(satirlar.join("\n")); } catch { /* noop */ }
                window.open("https://parselsorgu.tkgm.gov.tr/", "_blank", "noopener,noreferrer");
                setAdaParselBildirim(true);
                setTimeout(() => setAdaParselBildirim(false), 5000);
              }}
              className="flex items-center gap-2 text-sm text-blue-700 font-medium hover:underline"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              Ada-Parsel Sorgula
            </button>
          </div>

          {/* Belge Durumu */}
          <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
            <p className="text-sm font-semibold text-gray-700 mb-3">Belge Durumu</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Yapı İnşaat Ruhsatı <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-6">
                  {(["var", "yok"] as const).map((secenek) => (
                    <label key={secenek} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="yapiInsaatRuhsati"
                        value={secenek}
                        checked={form.yapiInsaatRuhsati === secenek}
                        onChange={() => guncelle("yapiInsaatRuhsati", secenek)}
                        className="text-blue-600 w-4 h-4"
                      />
                      <span className="text-sm text-gray-700">{secenek === "var" ? "Var" : "Yok"}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Proje <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-6">
                  {(["var", "yok"] as const).map((secenek) => (
                    <label key={secenek} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="proje"
                        value={secenek}
                        checked={form.proje === secenek}
                        onChange={() => guncelle("proje", secenek)}
                        className="text-blue-600 w-4 h-4"
                      />
                      <span className="text-sm text-gray-700">{secenek === "var" ? "Var" : "Yok"}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Başlangıç Fiyatı (₺) <span className="text-red-500">*</span>
              </label>
              <input
                type="number" required min="1" placeholder="5000000"
                value={form.baslangicFiyati} onChange={(e) => guncelle("baslangicFiyati", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Son Teklif Tarihi <span className="text-red-500">*</span>
              </label>
              <input
                type="date" required
                min={new Date().toISOString().split("T")[0]}
                max={maxBitisTarihi(planTuru)}
                value={form.bitisTarihi} onChange={(e) => guncelle("bitisTarihi", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-amber-600 mt-1">
                {planTuru === "ucretsiz"
                  ? `Ücretsiz planda en fazla ${PLAN_MAKS_IHALE_GUNU.ucretsiz} gün seçilebilir.`
                  : `${planTuru === "kurumsal" ? "Kurumsal" : "Premium"} planda en fazla ${
                      PLAN_MAKS_IHALE_GUNU[planTuru as PlanTuru] ?? PLAN_MAKS_IHALE_GUNU.ucretsiz
                    } gün seçilebilir.`}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                İdeal ihale süresi, başlangıç tarihinden itibaren 20-30 gün arasıdır.
              </p>
            </div>
          </div>

          {/* Belgeler */}
          <div className="border-t border-gray-100 pt-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Belgeler</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DosyaAlani
                label="Yapı Şartnamesi"
                kabul=".pdf"
                zorunlu
                dosya={dosyalar.sartname}
                onChange={(f) => setDosyalar((d) => ({ ...d, sartname: f }))}
              />
              <div>
                <DosyaAlani
                  label="Sözleşme Tasarısı"
                  kabul=".pdf"
                  dosya={dosyalar.sozlesme}
                  onChange={(f) => setDosyalar((d) => ({ ...d, sozlesme: f }))}
                />
                <button
                  type="button"
                  onClick={() => setSozlesmeModalAcik(true)}
                  className="mt-2 w-full flex items-center justify-center gap-2 border border-blue-200 bg-blue-50 text-blue-700 font-medium text-sm py-2.5 rounded-xl hover:bg-blue-100 hover:border-blue-300 transition-colors"
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Sözleşme Hazırla
                </button>
              </div>
              {form.proje === "var" && (
                <DosyaAlani
                  label="Bina Projesi"
                  kabul=".pdf,.dwg"
                  zorunlu
                  dosya={dosyalar.proje}
                  onChange={(f) => setDosyalar((d) => ({ ...d, proje: f }))}
                />
              )}
              <DosyaAlani
                label="Tapu Fotokopisi"
                kabul=".pdf,.jpg,.jpeg"
                dosya={dosyalar.tapu}
                onChange={(f) => setDosyalar((d) => ({ ...d, tapu: f }))}
              />
            </div>
          </div>

          {planTuru === "ucretsiz" && (
            <label className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 cursor-pointer">
              <input
                type="checkbox"
                checked={otomatikSonlandirmaOnay}
                onChange={(e) => setOtomatikSonlandirmaOnay(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-amber-600 rounded border-gray-300 focus:ring-amber-500 flex-shrink-0"
              />
              <span className="text-sm text-amber-800">
                İhale süresi dolduğunda <strong>2 gün içinde uzatma yapılmazsa</strong> ihale otomatik
                olarak sonlandırılacaktır. Bunu onaylıyor musunuz?
              </span>
            </label>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="submit" disabled={yukleniyor}
              className="flex-1 bg-blue-700 text-white font-semibold py-3 rounded-xl hover:bg-blue-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {yukleniyor ? "Yayınlanıyor..." : "İhaleyi Yayınla"}
            </button>
            <Link
              href="/ihaleler"
              className="flex-1 text-center border border-gray-200 text-gray-700 font-medium py-3 rounded-xl hover:bg-gray-50 transition-colors"
            >
              İptal
            </Link>
          </div>
        </form>
      </div>

      {sozlesmeModalAcik && (
        <SozlesmeModal
          tasinmaz={{
            il: form.sehir,
            ilce: form.ilce,
            mahalle: form.mahalle,
            ada: form.adaNo,
            parsel: form.parselNo,
            m2: form.yuzolcumuM2,
            ihaleTuru: form.kategori,
          }}
          arsaSahibiAdSoyadOnerilen={form.kurum || kullaniciAdSoyad}
          onKapat={() => setSozlesmeModalAcik(false)}
          onOlustur={(dosya) => {
            setDosyalar((d) => ({ ...d, sozlesme: dosya }));
            setSozlesmeModalAcik(false);
          }}
        />
      )}
    </div>
  );
}
