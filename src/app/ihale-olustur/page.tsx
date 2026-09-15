"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import DosyaAlani from "@/components/DosyaAlani";
import { PLAN_ILK_IHALE_GUNU } from "@/lib/plan-limitleri";
import { autoResizeTextarea } from "@/lib/ui";
import { dosyaAdiTemizle } from "@/lib/dosya";
import { hataMesaji } from "@/lib/hata-mesaji";
import type { PlanTuru, MulkiyetDurumu, KisiTuru } from "@/lib/types";

const ORNEK_SARTNAME_DOSYA: Record<string, string> = {
  "Kentsel Dönüşüm": "kentsel-donusum.docx",
  "Kat Karşılığı":   "kat-karsiligi.docx",
  "Yapı İnşaat":     "yapi-insaat.docx",
  "Bakım & Onarım":  "bakim-onarim.docx",
};

function ornekSartnameUrl(kategori: string): string | null {
  const dosya = ORNEK_SARTNAME_DOSYA[kategori];
  if (!dosya) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/ornek-sartnameler/${dosya}`;
}

const TASLAK_ANAHTARI = "ihale-olustur-taslak";

type DosyaAlanAdi = "sartname" | "sozlesme" | "proje" | "tapu" | "vekaletname" | "imzaSirkuleri";
type DosyalarState = Record<DosyaAlanAdi, File | null>;

const MULKIYET_SECENEKLERI: { deger: MulkiyetDurumu; etiket: string; aciklama: string }[] = [
  { deger: "tek_malik", etiket: "Tek Malikim",
    aciklama: "Taşınmazın tek maliki sizsiniz." },
  { deger: "hisseli", etiket: "Hisseli Mülkiyet",
    aciklama: "Taşınmazda başka hissedarlar da var." },
  { deger: "vekaleten", etiket: "Vekaleten İşlem Yapıyorum",
    aciklama: "Malik adına vekaletle işlem yapıyorsunuz." },
  { deger: "sirket", etiket: "Şirket Adına",
    aciklama: "Taşınmaz bir şirket/tüzel kişilik adına kayıtlı." },
];

interface DosyaTaslak { ad: string; tip: string; veriUrl: string; }
interface Taslak {
  form: Record<string, string>;
  otomatikSonlandirmaOnay: boolean;
  dosyalar: Partial<Record<DosyaAlanAdi, DosyaTaslak>>;
}

// File nesnesi JSON'a çevrilemediği için localStorage'a base64 data URL olarak yazılır.
function dosyaOku(dosya: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(dosya);
  });
}

// Tapu mükerrerlik kontrolü: aynı tapu belgesinin farklı ihalelerde
// kullanılıp kullanılmadığını admin panelinde tespit etmek için,
// dosyanın SHA-256 hash'i tarayıcıda hesaplanıp belgeler.dosya_hash'e
// yazılır (bkz. admin/ihaleler/[id]/page.tsx).
async function sha256Hex(dosya: File): Promise<string> {
  const veri = await dosya.arrayBuffer();
  const ozet = await crypto.subtle.digest("SHA-256", veri);
  return Array.from(new Uint8Array(ozet)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function dosyaGeriYukle(taslak: DosyaTaslak): File {
  const base64 = taslak.veriUrl.split(",")[1] ?? "";
  const ikili = atob(base64);
  const bayt = new Uint8Array(ikili.length);
  for (let i = 0; i < ikili.length; i++) bayt[i] = ikili.charCodeAt(i);
  return new File([bayt], taslak.ad, { type: taslak.tip });
}

const KATEGORILER = ["Kentsel Dönüşüm", "Kat Karşılığı", "Yapı İnşaat", "Bakım & Onarım"];

const ILLER = [
  "Adana","Ankara","Antalya","Aydın","Balıkesir","Bursa","Diyarbakır",
  "Erzurum","Eskişehir","Gaziantep","Hatay","İstanbul","İzmir",
  "Kayseri","Kocaeli","Konya","Malatya","Mersin","Muğla",
  "Samsun","Sakarya","Şanlıurfa","Trabzon","Van",
];

function AlanHatasi({ alan, eksikAlanlar }: { alan: string; eksikAlanlar: string[] }) {
  if (!eksikAlanlar.includes(alan)) return null;
  return <p className="text-xs text-red-600 mt-1">Bu alan zorunludur.</p>;
}

const ALAN_ETIKET: Record<string, string> = {
  baslik: "İhale Başlığı", kategori: "Kategori", aciklama: "Açıklama", kurum: "Kurum / Firma",
  sehir: "Şehir", ilce: "İlçe", mahalle: "Mahalle", caddeSokak: "Cadde/Sokak",
  yuzolcumuM2: "Yüzölçümü (m²)", adaNo: "Ada No", parselNo: "Parsel No",
  sureGun: "Yayında Kalma Süresi (gün)",
  yapiInsaatRuhsati: "Yapı İnşaat Ruhsatı", proje: "Proje",
  sartname: "Yapı Şartnamesi", tapu: "Tapu Fotokopisi", projeDosyasi: "Bina Projesi (Proje Var seçildi)",
  mulkiyetDurumu: "Mülkiyet Durumu", sirketUnvani: "Şirket Unvanı", yetkiliKisiAdi: "Yetkili Kişi Adı",
  otomatikSonlandirmaOnay: "Otomatik sonlandırma onayı",
};

export default function IhaleOlustur() {
  const router = useRouter();
  const [planTuru, setPlanTuru] = useState<string>("ucretsiz");
  const [kisiTuru, setKisiTuru] = useState<KisiTuru | null>(null);
  const [kimlikDurumu, setKimlikDurumu] = useState<"yukleniyor" | "girissiz" | "bekliyor" | "reddedildi" | "onaylandi">("yukleniyor");
  const [form, setForm] = useState({
    baslik: "", kategori: "", aciklama: "",
    kurum: "", sehir: "", ilce: "", mahalle: "", caddeSokak: "", adaNo: "", parselNo: "", yuzolcumuM2: "",
    sureGun: "",
    yapiInsaatRuhsati: "" as "" | "var" | "yok",
    proje: "" as "" | "var" | "yok",
    mulkiyetDurumu: "" as "" | MulkiyetDurumu,
    sirketUnvani: "", yetkiliKisiAdi: "",
    davetKodu: "",
  });
  const [basvuruSahibiAdi, setBasvuruSahibiAdi] = useState("");
  const [eksikAlanlar, setEksikAlanlar] = useState<string[]>([]);
  const [otomatikSonlandirmaOnay, setOtomatikSonlandirmaOnay] = useState(false);
  const [adaParselBildirim, setAdaParselBildirim] = useState(false);
  const [dosyalar, setDosyalar] = useState<DosyalarState>({
    sartname: null, sozlesme: null, proje: null, tapu: null, vekaletname: null, imzaSirkuleri: null,
  });
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState("");
  const [belgeUyarisi, setBelgeUyarisi] = useState<string[] | null>(null);
  const [onayModaliAcik, setOnayModaliAcik] = useState(false);
  const taslakYuklendiRef = useRef(false);
  const alanRef = useRef<Record<string, HTMLElement | null>>({});

  function refAta(alan: string) {
    // Zorunlu-alan validasyonu basarisiz oldugunda ilk hatali alana
    // scrollIntoView yapabilmek icin -- callback yalnizca commit
    // asamasinda .current'a yazar, render sirasinda okumaz.
    // eslint-disable-next-line react-hooks/refs
    return (el: HTMLElement | null) => { alanRef.current[alan] = el; };
  }

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { setKimlikDurumu("girissiz"); return; }
      const { data } = await supabase
        .from("kullanicilar")
        .select("plan_turu, ad_soyad, firma_adi, kisi_turu, kimlik_dogrulama_durumu")
        .eq("id", session.user.id)
        .single();
      if (data?.plan_turu) setPlanTuru(data.plan_turu);
      if (data?.ad_soyad) setBasvuruSahibiAdi(data.ad_soyad);
      setKisiTuru((data?.kisi_turu as KisiTuru | null) ?? null);
      setKimlikDurumu((data?.kimlik_dogrulama_durumu as "bekliyor" | "reddedildi" | "onaylandi") ?? "bekliyor");

      // Kurum/Firma alanını hesap türüne göre otomatik doldur -- kullanıcı
      // yine de değiştirebilir (bkz. form input'u aşağıda).
      const otomatikKurum = data?.kisi_turu === "kurumsal" ? data?.firma_adi : data?.ad_soyad;
      if (otomatikKurum) setForm((f) => (f.kurum ? f : { ...f, kurum: otomatikKurum }));
    });
  }, []);

  // Sayfa açılışında yarım kalan taslağı (metin alanları + dosyalar) geri
  // yükle — kayıt/giriş sayfasına yönlendirilip geri dönüldüğünde de çalışır.
  useEffect(() => {
    async function yukle() {
      try {
        const kayitli = localStorage.getItem(TASLAK_ANAHTARI);
        if (kayitli) {
          const taslak: Taslak = JSON.parse(kayitli);
          if (taslak.form) setForm((f) => ({ ...f, ...taslak.form }));
          if (typeof taslak.otomatikSonlandirmaOnay === "boolean") {
            setOtomatikSonlandirmaOnay(taslak.otomatikSonlandirmaOnay);
          }
          if (taslak.dosyalar) {
            const yeniDosyalar: DosyalarState = {
              sartname: null, sozlesme: null, proje: null, tapu: null, vekaletname: null, imzaSirkuleri: null,
            };
            (Object.keys(yeniDosyalar) as DosyaAlanAdi[]).forEach((alan) => {
              const dt = taslak.dosyalar[alan];
              if (dt) yeniDosyalar[alan] = dosyaGeriYukle(dt);
            });
            setDosyalar(yeniDosyalar);
          }
        }
      } catch { /* noop */ }
      taslakYuklendiRef.current = true;
    }
    yukle();
  }, []);

  // Her değişiklikte taslağı (metin + dosyalar) localStorage'a kaydet.
  useEffect(() => {
    if (!taslakYuklendiRef.current) return;
    const zamanlayici = setTimeout(async () => {
      try {
        const dosyaTaslaklari: Partial<Record<DosyaAlanAdi, DosyaTaslak>> = {};
        for (const alan of Object.keys(dosyalar) as DosyaAlanAdi[]) {
          const dosya = dosyalar[alan];
          if (dosya) {
            dosyaTaslaklari[alan] = { ad: dosya.name, tip: dosya.type, veriUrl: await dosyaOku(dosya) };
          }
        }
        const taslak: Taslak = { form, otomatikSonlandirmaOnay, dosyalar: dosyaTaslaklari };
        localStorage.setItem(TASLAK_ANAHTARI, JSON.stringify(taslak));
      } catch { /* noop — kota aşımı vb. */ }
    }, 400);
    return () => clearTimeout(zamanlayici);
  }, [form, dosyalar, otomatikSonlandirmaOnay]);

  function dogrula(): string[] {
    const eksik: string[] = [];
    if (!form.baslik.trim())          eksik.push("baslik");
    if (!form.kategori)               eksik.push("kategori");
    if (!form.aciklama.trim())        eksik.push("aciklama");
    if (!form.kurum.trim())           eksik.push("kurum");
    if (!form.sehir)                  eksik.push("sehir");
    if (!form.ilce.trim())            eksik.push("ilce");
    if (!form.mahalle.trim())         eksik.push("mahalle");
    if (!form.caddeSokak.trim())      eksik.push("caddeSokak");
    if (!form.adaNo.trim())           eksik.push("adaNo");
    if (!form.parselNo.trim())        eksik.push("parselNo");
    if (!form.yuzolcumuM2)            eksik.push("yuzolcumuM2");
    const maxGun = PLAN_ILK_IHALE_GUNU[planTuru as PlanTuru] ?? PLAN_ILK_IHALE_GUNU.ucretsiz;
    const sureGunSayi = Number(form.sureGun);
    if (!form.sureGun || sureGunSayi <= 0 || sureGunSayi > maxGun) eksik.push("sureGun");
    if (!form.yapiInsaatRuhsati)      eksik.push("yapiInsaatRuhsati");
    if (!form.proje)                  eksik.push("proje");
    if (!dosyalar.sartname)           eksik.push("sartname");
    if (!dosyalar.tapu)               eksik.push("tapu");
    if (form.proje === "var" && !dosyalar.proje) eksik.push("projeDosyasi");
    if (!form.mulkiyetDurumu)         eksik.push("mulkiyetDurumu");
    if (form.mulkiyetDurumu === "sirket") {
      if (!form.sirketUnvani.trim())   eksik.push("sirketUnvani");
      if (!form.yetkiliKisiAdi.trim()) eksik.push("yetkiliKisiAdi");
    }
    if (planTuru === "ucretsiz" && !otomatikSonlandirmaOnay) eksik.push("otomatikSonlandirmaOnay");
    return eksik;
  }

  // Hatalı alan özeti render edilip DOM'a eklendikten (ve üstteki hata
  // kutusu formu asagi ittikten) SONRA calisir -- setEksikAlanlar hemen
  // ardindan scrollIntoView cagirmak, hata kutusu henuz DOM'da yokken
  // eski (kutu olmadan hesaplanmis) konuma kaydirip ardindan kutunun
  // eklenmesiyle o konumu tekrar gecersiz kiliyordu (canli testte tespit
  // edildi -- sayfa yanlis, genelde sayfa ortasinda bir yere kayiyordu).
  useEffect(() => {
    if (eksikAlanlar.length === 0) return;
    const ilkAlan = alanRef.current[eksikAlanlar[0]];
    ilkAlan?.scrollIntoView({ behavior: "auto", block: "center" });
  }, [eksikAlanlar]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setHata("");

    const eksik = dogrula();
    setEksikAlanlar(eksik);
    if (eksik.length > 0) {
      return;
    }

    // Doğrulama geçti — yayınlama hakkının kullanılacağını onaylatmak için
    // önce onay modalı gösterilir, gerçek kayıt yalnızca "Evet" ile başlar.
    setOnayModaliAcik(true);
  }

  async function yayinla() {
    setOnayModaliAcik(false);
    setHata("");

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      // Doldurulan form (metinler + dosyalar) taslak olarak zaten
      // localStorage'da tutuluyor; kayıt/giriş sonrası bu sayfaya
      // dönüldüğünde otomatik geri yüklenir.
      router.push(`/kayit?next=${encodeURIComponent("/ihale-olustur")}`);
      return;
    }
    const kullaniciId = session.user.id;

    // Ücretsiz plandaki 1 ihale hakkı tek kullanımlıktır. Sayfa açılışında
    // yüklenen planTuru/state eski (stale) olabileceğinden burada tekrar,
    // taze bir sorguyla kontrol edilir.
    if (planTuru === "ucretsiz") {
      const { data: kullaniciData } = await supabase
        .from("kullanicilar")
        .select("ucretsiz_ihale_hakki_kullanildi")
        .eq("id", kullaniciId)
        .single();
      if (kullaniciData?.ucretsiz_ihale_hakki_kullanildi) {
        setHata("Ücretsiz ihale hakkınızı kullandınız, devam etmek için Premium'a geçin.");
        return;
      }
    }

    setYukleniyor(true);

    // Yayınlanma anına kadar (admin onayı) geri sayım başlamaz -- bitis_tarihi
    // burada yalnızca DB CHECK kısıtını (bitis > baslangic) sağlamak için
    // geçici olarak hesaplanır; admin onayladığında yayinlanma_tarihi baz
    // alınarak yeniden hesaplanır (bkz. admin/ihaleler/[id]/page.tsx).
    const baslangicTarihi = new Date().toISOString().split("T")[0];
    const sureGunSayi = Number(form.sureGun);
    const geciciBitisTarihi = (() => {
      const d = new Date();
      d.setDate(d.getDate() + sureGunSayi);
      return d.toISOString().split("T")[0];
    })();

    // 1. İhaleyi kaydet
    const { data: ihaleData, error: ihaleError } = await supabase
      .from("ihaleler")
      .insert({
        baslik:           form.baslik,
        kategori:         form.kategori,
        aciklama:         form.aciklama,
        kurum:            form.kurum,
        sehir:            form.sehir,
        ilce:             form.ilce,
        mahalle:          form.mahalle,
        cadde_sokak:      form.caddeSokak,
        ada_no:           form.adaNo,
        parsel_no:        form.parselNo,
        yuzolcumu_m2:     Number(form.yuzolcumuM2),
        // Platform kapali zarf sistemiyle calisir; arsa sahibi bir
        // baslangic fiyati belirlemez. Kolon DB'de NOT NULL + CHECK(>0)
        // oldugu icin (kaldirilmadi, sadece kullanimdan kaldirildi)
        // sabit bir yer tutucu deger gonderilir.
        baslangic_fiyati: 1,
        baslangic_tarihi: baslangicTarihi,
        bitis_tarihi:           geciciBitisTarihi,
        sure_gun:               sureGunSayi,
        durum:                  "beklemede",
        yapi_insaat_ruhsati:    form.yapiInsaatRuhsati || null,
        proje:                  form.proje || null,
        olusturan_id:           kullaniciId,
        mulkiyet_durumu:        form.mulkiyetDurumu || null,
        basvuru_sahibi_adi:     basvuruSahibiAdi || null,
        sirket_unvani:          form.mulkiyetDurumu === "sirket" ? form.sirketUnvani.trim()   : null,
        yetkili_kisi_adi:       form.mulkiyetDurumu === "sirket" ? form.yetkiliKisiAdi.trim()  : null,
      })
      .select("id")
      .single();

    if (ihaleError || !ihaleData) {
      const mesaj = ihaleError?.message?.includes("HIZ_SINIRI_ASILDI")
        ? "Kısa sürede çok fazla ihale oluşturdunuz. Lütfen bir süre sonra tekrar deneyin."
        : hataMesaji(ihaleError);
      setHata(mesaj);
      setYukleniyor(false);
      return;
    }

    // Ücretsiz plan: ilk (ve tek) ihale hakkı kullanıldı olarak işaretlenir.
    if (planTuru === "ucretsiz") {
      const { error: hakError } = await supabase
        .from("kullanicilar")
        .update({ ucretsiz_ihale_hakki_kullanildi: true })
        .eq("id", kullaniciId);
      if (hakError) console.error("Ücretsiz ihale hakkı işaretlenemedi:", hakError.message);
    }

    // Davetiye kodu girildiyse: davet edene, gerçekten bir ihale açıldığı
    // için (yalnızca kayıt değil) +1 teklif hakkı tanımlanır — aylık limit
    // aşılmışsa RPC sessizce no-op olur/bildirim gönderir. İhale oluşturma
    // akışını bloklamaz.
    if (form.davetKodu.trim()) {
      supabase.rpc("davet_kodu_aktivasyonu", {
        p_davet_kodu: form.davetKodu.trim(),
        p_aktivasyon_turu: "ihale",
      }).then(({ error }) => {
        if (error) console.warn("Davet kodu aktivasyonu başarısız:", error.message);
      });
    }

    // 2. Dosyaları Storage'a yükle ve belgeler tablosuna kaydet
    const dosyaYukle = async (
      dosya: File | null,
      tur: "proje" | "sozlesme" | "ruhsat" | "diger",
      baslik: string
    ): Promise<{ baslik: string; basarili: boolean } | null> => {
      if (!dosya) return null;
      const yol = `${ihaleData.id}/${tur}-${Date.now()}-${dosyaAdiTemizle(dosya.name)}`;
      const { data: storageData, error: storageError } = await supabase.storage
        .from("ihale-belgeleri")
        .upload(yol, dosya, { upsert: false });

      if (storageError || !storageData) return { baslik, basarili: false };

      const { data: urlData } = supabase.storage
        .from("ihale-belgeleri")
        .getPublicUrl(yol);

      const { error: belgeError } = await supabase.from("belgeler").insert({
        baslik,
        dosya_url:   urlData.publicUrl,
        dosya_tipi:  dosya.type,
        boyut:       dosya.size,
        tur,
        ihale_id:    ihaleData.id,
        yukleyen_id: kullaniciId,
      });
      return { baslik, basarili: !belgeError };
    };

    // Tapu, vekaletname/hissedar onayı ve imza sirküleri: herkese kapalı
    // ayrı bir bucket'a yüklenir, ortak dosyaYukle akışının aksine
    // genel-erişim URL'i üretilmez/saklanmaz — yalnızca admin RLS
    // politikasıyla storage'dan okuyabilir.
    const gizliBelgeYukle = async (
      dosya: File | null,
      tur: "tapu" | "vekaletname" | "imza_sirkuleri",
      baslik: string,
      dosyaAdiOnEki: string
    ): Promise<{ baslik: string; basarili: boolean } | null> => {
      if (!dosya) return null;
      const yol = `${ihaleData.id}/${dosyaAdiOnEki}-${Date.now()}-${dosyaAdiTemizle(dosya.name)}`;
      const [{ data: storageData, error: storageError }, dosyaHash] = await Promise.all([
        supabase.storage.from("ihale-tapu-belgeleri").upload(yol, dosya, { upsert: false }),
        tur === "tapu" ? sha256Hex(dosya).catch(() => null) : Promise.resolve(null),
      ]);

      if (storageError || !storageData) return { baslik, basarili: false };

      const { error: belgeError } = await supabase.from("belgeler").insert({
        baslik,
        dosya_url:   yol, // özel bucket içindeki yol — herkese açık URL değil
        dosya_tipi:  dosya.type,
        boyut:       dosya.size,
        dosya_hash:  dosyaHash,
        tur,
        ihale_id:    ihaleData.id,
        yukleyen_id: kullaniciId,
      });
      return { baslik, basarili: !belgeError };
    };

    const sonuclar = await Promise.allSettled([
      // "proje" turu yalnizca gercek bina projesi dosyasina ait olsun diye
      // (asagida ihale detay sayfasindaki "Proje: Var" rozeti bu turu
      // sorgulayarak dosyaya dogrudan baglaniyor) sartname "diger" ile etiketlenir.
      dosyaYukle(dosyalar.sartname, "diger",   "Yapı Şartnamesi"),
      dosyaYukle(dosyalar.sozlesme, "sozlesme", "Sözleşme Tasarısı"),
      dosyaYukle(dosyalar.proje,    "proje",    "Bina Projesi"),
      gizliBelgeYukle(dosyalar.tapu,         "tapu",           "Tapu Fotokopisi",                     "tapu"),
      gizliBelgeYukle(dosyalar.vekaletname,  "vekaletname",    "Vekaletname / Hissedar Onay Belgesi", "vekaletname"),
      gizliBelgeYukle(dosyalar.imzaSirkuleri,"imza_sirkuleri", "İmza Sirküleri",                      "imza-sirkuleri"),
    ]);

    const basarisizlar = sonuclar
      .map((s) => (s.status === "fulfilled" ? s.value : { baslik: "Bilinmeyen belge", basarili: false }))
      .filter((s): s is { baslik: string; basarili: boolean } => s !== null && !s.basarili)
      .map((s) => s.baslik);

    setYukleniyor(false);
    try { localStorage.removeItem(TASLAK_ANAHTARI); } catch { /* noop */ }

    if (basarisizlar.length > 0) {
      // İhale oluşturuldu ama en az bir belge yüklenemedi (bağlantı kopması,
      // depolama hatası vb.) — sessizce yönlendirmek yerine kullanıcıyı
      // açıkça uyar, aksi halde belgesinin yüklendiğini sanıp panelden
      // ayrılırdı.
      setBelgeUyarisi(basarisizlar);
      return;
    }

    // İhale başarıyla yayınlandı — kullanıcıyı beklemeden otomatik olarak
    // ihalelerim sayfasına yönlendir; başarı mesajı orada (query param'a
    // bağlı olarak) gösterilir.
    router.push("/panel/ihalelerim?yayin=basarili");
  }

  function guncelle(alan: string, deger: string) {
    setForm((f) => ({ ...f, [alan]: deger }));
  }

  // Zorunlu alan hatası -- kırmızı çerçeve.
  function hataSinifi(alan: string): string {
    return eksikAlanlar.includes(alan) ? "border-red-400 ring-1 ring-red-300" : "";
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

        {kimlikDurumu === "bekliyor" || kimlikDurumu === "reddedildi" ? (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-8 text-center">
            <p className="text-blue-900 font-semibold mb-2">
              {kimlikDurumu === "reddedildi" ? "Kimlik doğrulamanız reddedildi" : "Kimlik doğrulamanızı tamamlayın"}
            </p>
            <p className="text-sm text-blue-700 mb-5">
              İhale yayınlayabilmek için önce kimlik/kurum doğrulamanızı tamamlamanız gerekir.
              {kimlikDurumu === "reddedildi" && " Bilgilerinizi güncelleyip yeniden başvurabilirsiniz."}
            </p>
            <Link
              href="/onboarding"
              className="inline-block bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-800 transition-colors text-sm"
            >
              Kimlik Doğrulamaya Git →
            </Link>
          </div>
        ) : (
        <>
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

        {belgeUyarisi && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg p-4 mb-6">
            <p className="font-semibold mb-1">İhaleniz oluşturuldu ancak bazı belgeler yüklenemedi:</p>
            <ul className="list-disc list-inside mb-3">
              {belgeUyarisi.map((b) => <li key={b}>{b}</li>)}
            </ul>
            <p className="mb-3">
              Bu durum genellikle bağlantı kopmasından kaynaklanır. Lütfen destek ekibimizle iletişime geçip
              eksik belgeleri iletin, aksi halde admin incelemesi tamamlanamayabilir.
            </p>
            <button
              type="button"
              onClick={() => { router.push("/ihaleler"); router.refresh(); }}
              className="bg-amber-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors text-sm"
            >
              Anladım, İhalelere Git
            </button>
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
                <li key={alan}>{ALAN_ETIKET[alan] ?? alan}</li>
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
              ref={refAta("baslik")}
              type="text" required autoCapitalize="words" placeholder="Örn: Kadıköy Sosyal Konut Projesi"
              value={form.baslik} onChange={(e) => guncelle("baslik", e.target.value)}
              className={`w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${hataSinifi("baslik")}`}
            />
            <AlanHatasi alan="baslik" eksikAlanlar={eksikAlanlar} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Kategori <span className="text-red-500">*</span>
            </label>
            <select
              ref={refAta("kategori")}
              required value={form.kategori} onChange={(e) => guncelle("kategori", e.target.value)}
              className={`w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${hataSinifi("kategori")}`}
            >
              <option value="">Kategori seçin...</option>
              {KATEGORILER.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <AlanHatasi alan="kategori" eksikAlanlar={eksikAlanlar} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Açıklama <span className="text-red-500">*</span>
            </label>
            <textarea
              ref={refAta("aciklama")}
              required rows={4} placeholder="İhale kapsamını, teknik şartları ve beklentileri açıklayın..."
              value={form.aciklama} onChange={(e) => guncelle("aciklama", e.target.value)}
              onInput={autoResizeTextarea}
              className={`w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${hataSinifi("aciklama")}`}
            />
            <AlanHatasi alan="aciklama" eksikAlanlar={eksikAlanlar} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {kisiTuru === "kurumsal" ? "Kurum/Firma Adı" : "Ad Soyad"} <span className="text-red-500">*</span>
              </label>
              <input
                ref={refAta("kurum")}
                type="text" required placeholder={kisiTuru === "kurumsal" ? "Yılmaz İnşaat A.Ş." : "Ad Soyad"}
                value={form.kurum} onChange={(e) => guncelle("kurum", e.target.value)}
                className={`w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${hataSinifi("kurum")}`}
              />
              <AlanHatasi alan="kurum" eksikAlanlar={eksikAlanlar} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Şehir <span className="text-red-500">*</span>
              </label>
              <select
                ref={refAta("sehir")}
                required value={form.sehir} onChange={(e) => guncelle("sehir", e.target.value)}
                className={`w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${hataSinifi("sehir")}`}
              >
                <option value="">İl seçin...</option>
                {ILLER.map((il) => <option key={il} value={il}>{il}</option>)}
              </select>
              <AlanHatasi alan="sehir" eksikAlanlar={eksikAlanlar} />
            </div>
          </div>

          {/* Tapu / Parsel Bilgileri */}
          <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
            <p className="text-sm font-semibold text-gray-700 mb-3">Tapu / Parsel Bilgileri</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  İlçe <span className="text-red-500">*</span>
                </label>
                <input
                  ref={refAta("ilce")}
                  type="text" required placeholder="Örn: Kadıköy"
                  value={form.ilce} onChange={(e) => guncelle("ilce", e.target.value)}
                  className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm ${hataSinifi("ilce")}`}
                />
                <AlanHatasi alan="ilce" eksikAlanlar={eksikAlanlar} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Mahalle <span className="text-red-500">*</span>
                </label>
                <input
                  ref={refAta("mahalle")}
                  type="text" required placeholder="Örn: Caferağa"
                  value={form.mahalle} onChange={(e) => guncelle("mahalle", e.target.value)}
                  className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm ${hataSinifi("mahalle")}`}
                />
                <AlanHatasi alan="mahalle" eksikAlanlar={eksikAlanlar} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Cadde/Sokak <span className="text-red-500">*</span>
                </label>
                <input
                  ref={refAta("caddeSokak")}
                  type="text" required placeholder="Örn: Bahariye Caddesi"
                  value={form.caddeSokak} onChange={(e) => guncelle("caddeSokak", e.target.value)}
                  className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm ${hataSinifi("caddeSokak")}`}
                />
                <AlanHatasi alan="caddeSokak" eksikAlanlar={eksikAlanlar} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Yüzölçümü (m²) <span className="text-red-500">*</span>
                </label>
                <input
                  ref={refAta("yuzolcumuM2")}
                  type="number" required min="0" placeholder="Örn: 1200"
                  value={form.yuzolcumuM2} onChange={(e) => guncelle("yuzolcumuM2", e.target.value)}
                  className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm ${hataSinifi("yuzolcumuM2")}`}
                />
                <AlanHatasi alan="yuzolcumuM2" eksikAlanlar={eksikAlanlar} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Ada No <span className="text-red-500">*</span>
                </label>
                <input
                  ref={refAta("adaNo")}
                  type="text" required placeholder="Örn: 2841"
                  value={form.adaNo} onChange={(e) => guncelle("adaNo", e.target.value)}
                  className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm ${hataSinifi("adaNo")}`}
                />
                <AlanHatasi alan="adaNo" eksikAlanlar={eksikAlanlar} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Parsel No <span className="text-red-500">*</span>
                </label>
                <input
                  ref={refAta("parselNo")}
                  type="text" required placeholder="Örn: 14"
                  value={form.parselNo} onChange={(e) => guncelle("parselNo", e.target.value)}
                  className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm ${hataSinifi("parselNo")}`}
                />
                <AlanHatasi alan="parselNo" eksikAlanlar={eksikAlanlar} />
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
                <div ref={refAta("yapiInsaatRuhsati")} className="flex gap-6">
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
                <AlanHatasi alan="yapiInsaatRuhsati" eksikAlanlar={eksikAlanlar} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Proje <span className="text-red-500">*</span>
                </label>
                <div ref={refAta("proje")} className="flex gap-6">
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
                <AlanHatasi alan="proje" eksikAlanlar={eksikAlanlar} />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Yayında Kalma Süresi (gün) <span className="text-red-500">*</span>
            </label>
            <input
              ref={refAta("sureGun")}
              type="number" required min={1}
              max={PLAN_ILK_IHALE_GUNU[planTuru as PlanTuru] ?? PLAN_ILK_IHALE_GUNU.ucretsiz}
              placeholder={`Örn: ${PLAN_ILK_IHALE_GUNU[planTuru as PlanTuru] ?? PLAN_ILK_IHALE_GUNU.ucretsiz}`}
              value={form.sureGun} onChange={(e) => guncelle("sureGun", e.target.value)}
              className={`w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ${hataSinifi("sureGun")}`}
            />
            <AlanHatasi alan="sureGun" eksikAlanlar={eksikAlanlar} />
            <p className="text-xs text-amber-600 mt-1">
              {planTuru === "ucretsiz"
                ? `Ücretsiz planda en fazla ${PLAN_ILK_IHALE_GUNU.ucretsiz} gün seçilebilir.`
                : `${planTuru === "kurumsal" ? "Kurumsal" : "Premium"} planda en fazla ${
                    PLAN_ILK_IHALE_GUNU[planTuru as PlanTuru] ?? PLAN_ILK_IHALE_GUNU.ucretsiz
                  } gün seçilebilir.`}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Geri sayım, ihaleniz admin onayından geçip yayına girdiği andan itibaren başlar —
              admin incelemesi süresince bu gün sayısı kullanılmaz.
            </p>
          </div>

          {/* Mülkiyet Durumu */}
          <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
            <p className="text-sm font-semibold text-gray-700 mb-1">
              Bu taşınmazın mülkiyet durumu nedir? <span className="text-red-500">*</span>
            </p>
            <p className="text-xs text-gray-400 mb-3">
              Bu bilgi yalnızca admin incelemesinde tapu belgesiyle karşılaştırma amaçlıdır.
            </p>
            <div ref={refAta("mulkiyetDurumu")} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {MULKIYET_SECENEKLERI.map((s) => (
                <label
                  key={s.deger}
                  className={`flex items-start gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all bg-white ${
                    form.mulkiyetDurumu === s.deger ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="mulkiyetDurumu"
                    value={s.deger}
                    checked={form.mulkiyetDurumu === s.deger}
                    onChange={() => guncelle("mulkiyetDurumu", s.deger)}
                    className="mt-0.5 text-blue-600 w-4 h-4 flex-shrink-0"
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-900">{s.etiket}</span>
                    <span className="block text-xs text-gray-400">{s.aciklama}</span>
                  </span>
                </label>
              ))}
            </div>
            <AlanHatasi alan="mulkiyetDurumu" eksikAlanlar={eksikAlanlar} />

            {form.mulkiyetDurumu === "sirket" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Şirket Unvanı <span className="text-red-500">*</span>
                  </label>
                  <input
                    ref={refAta("sirketUnvani")}
                    type="text" required placeholder="Örn: ABC İnşaat A.Ş."
                    value={form.sirketUnvani} onChange={(e) => guncelle("sirketUnvani", e.target.value)}
                    className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm ${hataSinifi("sirketUnvani")}`}
                  />
                  <AlanHatasi alan="sirketUnvani" eksikAlanlar={eksikAlanlar} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Yetkili Kişi Adı <span className="text-red-500">*</span>
                  </label>
                  <input
                    ref={refAta("yetkiliKisiAdi")}
                    type="text" required placeholder="Örn: Ahmet Yılmaz"
                    value={form.yetkiliKisiAdi} onChange={(e) => guncelle("yetkiliKisiAdi", e.target.value)}
                    className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm ${hataSinifi("yetkiliKisiAdi")}`}
                  />
                  <AlanHatasi alan="yetkiliKisiAdi" eksikAlanlar={eksikAlanlar} />
                </div>
              </div>
            )}
          </div>

          {/* Belgeler */}
          <div className="border-t border-gray-100 pt-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Belgeler</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div ref={refAta("sartname")}>
                <DosyaAlani
                  label="Yapı Şartnamesi"
                  kabul=".pdf"
                  zorunlu
                  dosya={dosyalar.sartname}
                  onChange={(f) => setDosyalar((d) => ({ ...d, sartname: f }))}
                />
                <AlanHatasi alan="sartname" eksikAlanlar={eksikAlanlar} />
                {ornekSartnameUrl(form.kategori) && (
                  <a
                    href={ornekSartnameUrl(form.kategori)!}
                    className="text-xs font-medium text-blue-700 hover:underline mt-1.5 inline-block"
                  >
                    Örnek şartname indir ({form.kategori}) →
                  </a>
                )}
              </div>
              <DosyaAlani
                label="Sözleşme Tasarısı"
                kabul=".pdf"
                dosya={dosyalar.sozlesme}
                onChange={(f) => setDosyalar((d) => ({ ...d, sozlesme: f }))}
              />
              {form.proje === "var" && (
                <div ref={refAta("projeDosyasi")}>
                  <DosyaAlani
                    label="Bina Projesi"
                    kabul=".pdf,.dwg"
                    zorunlu
                    dosya={dosyalar.proje}
                    onChange={(f) => setDosyalar((d) => ({ ...d, proje: f }))}
                    maksBoyutMB={40}
                  />
                  <AlanHatasi alan="projeDosyasi" eksikAlanlar={eksikAlanlar} />
                </div>
              )}
              <div ref={refAta("tapu")}>
                <DosyaAlani
                  label="Tapu Fotokopisi"
                  kabul=".pdf,.jpg,.jpeg"
                  zorunlu
                  dosya={dosyalar.tapu}
                  onChange={(f) => setDosyalar((d) => ({ ...d, tapu: f }))}
                />
                <AlanHatasi alan="tapu" eksikAlanlar={eksikAlanlar} />
                <p className="text-xs text-gray-400 mt-1.5">
                  Yalnızca ihalenin gerçekliğini doğrulamak için istenir. Kimseyle paylaşılmaz;
                  yalnızca yetkili yöneticiler erişebilir.
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  e-Devlet üzerinden alınan, taşınmazın tüm hak sahiplerini gösteren QR kodlu/barkodlu
                  tapu bilgisi belgesinin yüklenmesi gerekmektedir.
                </p>
              </div>
              {(form.mulkiyetDurumu === "hisseli" || form.mulkiyetDurumu === "vekaleten") && (
                <div>
                  <DosyaAlani
                    label="Vekaletname veya Hissedar Onay Belgesi"
                    kabul=".pdf"
                    dosya={dosyalar.vekaletname}
                    onChange={(f) => setDosyalar((d) => ({ ...d, vekaletname: f }))}
                  />
                  <p className="text-xs text-gray-400 mt-1.5">
                    Yalnızca admin incelemesi için kullanılır; kimseyle paylaşılmaz.
                  </p>
                </div>
              )}
              {form.mulkiyetDurumu === "sirket" && (
                <div>
                  <DosyaAlani
                    label="İmza Sirküleri"
                    kabul=".pdf"
                    dosya={dosyalar.imzaSirkuleri}
                    onChange={(f) => setDosyalar((d) => ({ ...d, imzaSirkuleri: f }))}
                  />
                  <p className="text-xs text-gray-400 mt-1.5">
                    Yalnızca admin incelemesi için kullanılır; kimseyle paylaşılmaz.
                  </p>
                </div>
              )}
            </div>
          </div>

          {planTuru === "ucretsiz" && (
            <div ref={refAta("otomatikSonlandirmaOnay")}>
              <label className={`flex items-start gap-3 bg-amber-50 border rounded-xl px-4 py-3 cursor-pointer ${
                eksikAlanlar.includes("otomatikSonlandirmaOnay") ? "border-red-400 ring-1 ring-red-300" : "border-amber-200"
              }`}>
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
              <AlanHatasi alan="otomatikSonlandirmaOnay" eksikAlanlar={eksikAlanlar} />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Davetiye Kodu <span className="text-gray-400 font-normal">(varsa)</span>
            </label>
            <input
              type="text" placeholder="ABC123"
              value={form.davetKodu} onChange={(e) => guncelle("davetKodu", e.target.value.toUpperCase())}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
            />
            <p className="text-xs text-gray-400 mt-1.5">
              Bir müteahhitin davet kodunu kullanıyorsanız buraya girin — ihaleniz yayınlandığında davet eden kişiye 1 teklif hakkı tanımlanır.
            </p>
          </div>

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
        </>
        )}
      </div>

      {/* Yayınlama Onay Modalı */}
      {onayModaliAcik && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">İhaleyi yayınlamak istediğinize emin misiniz?</h2>
            <p className="text-sm text-gray-600 mb-6">Yayınlama hakkınız kullanılacaktır.</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setOnayModaliAcik(false)}
                className="flex-1 border border-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Hayır
              </button>
              <button
                type="button"
                onClick={yayinla}
                disabled={yukleniyor}
                className="flex-1 bg-blue-700 text-white font-semibold py-2.5 rounded-xl hover:bg-blue-800 transition-colors disabled:opacity-60"
              >
                {yukleniyor ? "Yayınlanıyor..." : "Evet"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
