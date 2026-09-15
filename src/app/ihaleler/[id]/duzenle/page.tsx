"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import DosyaAlani from "@/components/DosyaAlani";
import { autoResizeTextarea } from "@/lib/ui";
import { dosyaAdiTemizle } from "@/lib/dosya";
import { PLAN_ILK_IHALE_GUNU } from "@/lib/plan-limitleri";
import type { Ihale, MulkiyetDurumu, PlanTuru } from "@/lib/types";

const KATEGORILER = ["Kentsel Dönüşüm", "Kat Karşılığı", "Yapı İnşaat", "Bakım & Onarım"];

const MULKIYET_SECENEKLERI: { deger: MulkiyetDurumu; etiket: string }[] = [
  { deger: "tek_malik", etiket: "Tek Malikim" },
  { deger: "hisseli", etiket: "Hisseli Mülkiyet" },
  { deger: "vekaleten", etiket: "Vekaleten İşlem Yapıyorum" },
  { deger: "sirket", etiket: "Şirket Adına" },
];

async function sha256Hex(dosya: File): Promise<string> {
  const veri = await dosya.arrayBuffer();
  const ozet = await crypto.subtle.digest("SHA-256", veri);
  return Array.from(new Uint8Array(ozet)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function IhaleDuzenle() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [ihale, setIhale] = useState<Ihale | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [yetkisiz, setYetkisiz] = useState(false);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [hata, setHata] = useState("");
  const [planTuru, setPlanTuru] = useState<string>("ucretsiz");

  const [form, setForm] = useState({
    baslik: "", kategori: "", aciklama: "", kurum: "",
    ilce: "", mahalle: "", caddeSokak: "", adaNo: "", parselNo: "",
    mulkiyetDurumu: "" as "" | MulkiyetDurumu,
    sirketUnvani: "", yetkiliKisiAdi: "",
  });

  const [yeniSartname, setYeniSartname] = useState<File | null>(null);
  const [yeniTapu, setYeniTapu] = useState<File | null>(null);

  useEffect(() => {
    const supabase = createClient();
    async function yukle() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.replace(`/giris?next=${encodeURIComponent(`/ihaleler/${id}/duzenle`)}`); return; }

      const { data } = await supabase.from("ihaleler").select("*").eq("id", id).single();
      if (!data || data.olusturan_id !== session.user.id) { setYetkisiz(true); setYukleniyor(false); return; }

      const ihaleData = data as Ihale;
      setIhale(ihaleData);
      setForm({
        baslik: ihaleData.baslik, kategori: ihaleData.kategori, aciklama: ihaleData.aciklama,
        kurum: ihaleData.kurum, ilce: ihaleData.ilce ?? "", mahalle: ihaleData.mahalle ?? "",
        caddeSokak: ihaleData.cadde_sokak ?? "", adaNo: ihaleData.ada_no ?? "", parselNo: ihaleData.parsel_no ?? "",
        mulkiyetDurumu: ihaleData.mulkiyet_durumu ?? "",
        sirketUnvani: ihaleData.sirket_unvani ?? "", yetkiliKisiAdi: ihaleData.yetkili_kisi_adi ?? "",
      });

      const { data: profil } = await supabase.from("kullanicilar").select("plan_turu").eq("id", session.user.id).single();
      if (profil?.plan_turu) setPlanTuru(profil.plan_turu);

      setYukleniyor(false);
    }
    yukle();
  }, [id, router]);

  function guncelle(alan: string, deger: string) {
    setForm((f) => ({ ...f, [alan]: deger }));
  }

  async function kaydet(e: React.FormEvent) {
    e.preventDefault();
    if (!ihale) return;
    setHata("");
    setKaydediliyor(true);
    const supabase = createClient();

    // inceleme_durumu/red_sebebi/durum RLS trigger'ı tarafından sahibine
    // kapatıldığı için (admin incelemesini bypass edemesin diye) bu
    // güncelleme SECURITY DEFINER bir RPC üzerinden yapılır -- yalnızca
    // gerçekten reddedilmiş kendi ihalesinde çalışır (bkz. migration).
    const { error } = await supabase.rpc("ihale_duzenle_ve_tekrar_gonder", {
      p_ihale_id: ihale.id,
      p_baslik: form.baslik,
      p_kategori: form.kategori,
      p_aciklama: form.aciklama,
      p_kurum: form.kurum,
      p_ilce: form.ilce,
      p_mahalle: form.mahalle,
      p_cadde_sokak: form.caddeSokak,
      p_ada_no: form.adaNo,
      p_parsel_no: form.parselNo,
      p_mulkiyet_durumu: form.mulkiyetDurumu || null,
      p_sirket_unvani: form.mulkiyetDurumu === "sirket" ? form.sirketUnvani.trim() : null,
      p_yetkili_kisi_adi: form.mulkiyetDurumu === "sirket" ? form.yetkiliKisiAdi.trim() : null,
    });

    if (error) { setHata("Kaydedilemedi: " + error.message); setKaydediliyor(false); return; }

    // Yeni belge yüklendiyse (opsiyonel) ekle -- eski belgeler admin
    // incelemesi için silinmeden korunur, en güncel belge tarih sırasına
    // göre öne çıkar.
    try {
      if (yeniSartname) {
        const yol = `${ihale.id}/diger-${Date.now()}-${dosyaAdiTemizle(yeniSartname.name)}`;
        const { error: sErr } = await supabase.storage.from("ihale-belgeleri").upload(yol, yeniSartname, { upsert: false });
        if (!sErr) {
          const { data: urlData } = supabase.storage.from("ihale-belgeleri").getPublicUrl(yol);
          await supabase.from("belgeler").insert({
            baslik: "Yapı Şartnamesi (güncellendi)", dosya_url: urlData.publicUrl,
            dosya_tipi: yeniSartname.type, boyut: yeniSartname.size, tur: "diger",
            ihale_id: ihale.id, yukleyen_id: ihale.olusturan_id,
          });
        }
      }
      if (yeniTapu) {
        const yol = `${ihale.id}/tapu-${Date.now()}-${dosyaAdiTemizle(yeniTapu.name)}`;
        const dosyaHash = await sha256Hex(yeniTapu).catch(() => null);
        const { error: tErr } = await supabase.storage.from("ihale-tapu-belgeleri").upload(yol, yeniTapu, { upsert: false });
        if (!tErr) {
          await supabase.from("belgeler").insert({
            baslik: "Tapu Fotokopisi (güncellendi)", dosya_url: yol,
            dosya_tipi: yeniTapu.type, boyut: yeniTapu.size, dosya_hash: dosyaHash, tur: "tapu",
            ihale_id: ihale.id, yukleyen_id: ihale.olusturan_id,
          });
        }
      }
    } catch { /* belge yükleme hatası kaydı engellemez, ihale zaten guncellendi */ }

    setKaydediliyor(false);
    router.push("/panel");
    router.refresh();
  }

  if (yetkisiz) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center">
        <p className="text-gray-600">Bu ihaleyi düzenleme yetkiniz yok.</p>
      </div>
    );
  }

  if (yukleniyor || !ihale) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="h-96 bg-white border border-gray-200 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-8">
        <Link href="/panel" className="hover:text-blue-700">Panelim</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">İhaleyi Düzenle</span>
      </nav>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">İhaleyi Düzenle</h1>
        <p className="text-gray-500 text-sm mb-4">
          Değişikliklerinizi kaydettiğinizde ihaleniz yeniden admin incelemesine gönderilir.
        </p>

        {ihale.red_sebebi && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-4 mb-6">
            <p className="font-semibold mb-1">Reddedilme sebebi</p>
            <p>{ihale.red_sebebi}</p>
          </div>
        )}

        {hata && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-6">{hata}</div>}

        <form onSubmit={kaydet} className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">İhale Başlığı</label>
            <input
              type="text" required autoCapitalize="words" value={form.baslik} onChange={(e) => guncelle("baslik", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Kategori</label>
            <select
              required value={form.kategori} onChange={(e) => guncelle("kategori", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {KATEGORILER.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Açıklama</label>
            <textarea
              required rows={4} value={form.aciklama} onChange={(e) => guncelle("aciklama", e.target.value)}
              onInput={autoResizeTextarea}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Kurum / Firma</label>
            <input
              type="text" required value={form.kurum} onChange={(e) => guncelle("kurum", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
            <p className="text-sm font-semibold text-gray-700 mb-3">Tapu / Parsel Bilgileri</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input placeholder="İlçe" required value={form.ilce} onChange={(e) => guncelle("ilce", e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input placeholder="Mahalle" required value={form.mahalle} onChange={(e) => guncelle("mahalle", e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input placeholder="Cadde/Sokak" required value={form.caddeSokak} onChange={(e) => guncelle("caddeSokak", e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input placeholder="Ada No" required value={form.adaNo} onChange={(e) => guncelle("adaNo", e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input placeholder="Parsel No" required value={form.parselNo} onChange={(e) => guncelle("parselNo", e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
            <p className="text-sm font-semibold text-gray-700 mb-3">Mülkiyet Durumu</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {MULKIYET_SECENEKLERI.map((s) => (
                <label
                  key={s.deger}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 cursor-pointer bg-white ${
                    form.mulkiyetDurumu === s.deger ? "border-blue-500 bg-blue-50" : "border-gray-200"
                  }`}
                >
                  <input
                    type="radio" name="mulkiyetDurumu" checked={form.mulkiyetDurumu === s.deger}
                    onChange={() => guncelle("mulkiyetDurumu", s.deger)} className="text-blue-600 w-4 h-4"
                  />
                  <span className="text-sm text-gray-900">{s.etiket}</span>
                </label>
              ))}
            </div>
            {form.mulkiyetDurumu === "sirket" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200">
                <input placeholder="Şirket Unvanı" required value={form.sirketUnvani} onChange={(e) => guncelle("sirketUnvani", e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input placeholder="Yetkili Kişi Adı" required value={form.yetkiliKisiAdi} onChange={(e) => guncelle("yetkiliKisiAdi", e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 pt-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Belgeleri Güncelle</h2>
            <p className="text-xs text-gray-400 mb-4">İsteğe bağlı — yüklemezseniz mevcut belgeleriniz korunur.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DosyaAlani label="Yeni Yapı Şartnamesi" kabul=".pdf" dosya={yeniSartname} onChange={setYeniSartname} />
              <DosyaAlani label="Yeni Tapu Fotokopisi" kabul=".pdf,.jpg,.jpeg" dosya={yeniTapu} onChange={setYeniTapu} />
            </div>
          </div>

          <p className="text-xs text-gray-400">
            {planTuru === "ucretsiz"
              ? `Ücretsiz planda en fazla ${PLAN_ILK_IHALE_GUNU.ucretsiz} gün.`
              : `${planTuru === "kurumsal" ? "Kurumsal" : "Premium"} planda en fazla ${
                  PLAN_ILK_IHALE_GUNU[planTuru as PlanTuru] ?? PLAN_ILK_IHALE_GUNU.ucretsiz
                } gün.`}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="submit" disabled={kaydediliyor}
              className="flex-1 bg-blue-700 text-white font-semibold py-3 rounded-xl hover:bg-blue-800 transition-colors disabled:opacity-60"
            >
              {kaydediliyor ? "Kaydediliyor..." : "Kaydet ve Yeniden Gönder"}
            </button>
            <Link href="/panel" className="flex-1 text-center border border-gray-200 text-gray-700 font-medium py-3 rounded-xl hover:bg-gray-50 transition-colors">
              İptal
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
