"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import DosyaAlani from "@/components/DosyaAlani";
import { dosyaAdiTemizle } from "@/lib/dosya";
import type { KisiTuru } from "@/lib/types";

const BUCKET = "admin_belgeler_dogrulama";

function tcKimlikGecerliMi(deger: string): boolean {
  return /^\d{11}$/.test(deger.trim());
}

function vergiNoGecerliMi(deger: string): boolean {
  return /^\d{10}$/.test(deger.trim());
}

export default function Onboarding() {
  const router = useRouter();
  const [kullaniciId, setKullaniciId] = useState<string | null>(null);
  const [durumYuklendi, setDurumYuklendi] = useState(false);
  const [mevcutDurum, setMevcutDurum] = useState<"bekliyor" | "onaylandi" | "reddedildi">("bekliyor");

  const [adim, setAdim] = useState<1 | 2>(1);
  const [kisiTuru, setKisiTuru] = useState<KisiTuru | null>(null);

  const [adSoyad, setAdSoyad] = useState("");
  const [firmaAdi, setFirmaAdi] = useState("");
  const [tcKimlikNo, setTcKimlikNo] = useState("");
  const [vergiNo, setVergiNo] = useState("");

  const [kimlikOn, setKimlikOn] = useState<File | null>(null);
  const [kimlikArka, setKimlikArka] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [imzaSirkuleri, setImzaSirkuleri] = useState<File | null>(null);
  const [ticaretSicil, setTicaretSicil] = useState<File | null>(null);

  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [hata, setHata] = useState("");
  const [basarili, setBasarili] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { router.replace(`/giris?next=${encodeURIComponent("/onboarding")}`); return; }
      setKullaniciId(session.user.id);
      const { data } = await supabase
        .from("kullanicilar")
        .select("ad_soyad, firma_adi, kisi_turu, kimlik_dogrulama_durumu")
        .eq("id", session.user.id)
        .single();
      if (data?.ad_soyad) setAdSoyad(data.ad_soyad);
      if (data?.firma_adi) setFirmaAdi(data.firma_adi);
      setMevcutDurum((data?.kimlik_dogrulama_durumu as "bekliyor" | "onaylandi" | "reddedildi") ?? "bekliyor");
      setDurumYuklendi(true);
    });
  }, [router]);

  function dosyaGecerliMi(dosya: File | null): boolean {
    if (!dosya) return false;
    if (dosya.size <= 0) return false;
    const uzanti = "." + dosya.name.split(".").pop()?.toLowerCase();
    return [".pdf", ".jpg", ".jpeg", ".png"].includes(uzanti);
  }

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setHata("");
    if (!kullaniciId || !kisiTuru) return;

    if (kisiTuru === "bireysel") {
      if (!tcKimlikGecerliMi(tcKimlikNo)) { setHata("TC kimlik numarası 11 haneli olmalıdır."); return; }
      if (!adSoyad.trim()) { setHata("Ad soyad zorunludur."); return; }
      if (!dosyaGecerliMi(kimlikOn) || !dosyaGecerliMi(kimlikArka) || !dosyaGecerliMi(selfie)) {
        setHata("Kimlik ön yüz, arka yüz ve selfie belgelerinin tümü zorunludur.");
        return;
      }
    } else {
      if (!vergiNoGecerliMi(vergiNo)) { setHata("Vergi numarası 10 haneli olmalıdır."); return; }
      if (!firmaAdi.trim()) { setHata("Firma adı zorunludur."); return; }
      if (!dosyaGecerliMi(imzaSirkuleri) || !dosyaGecerliMi(ticaretSicil)) {
        setHata("İmza sirküleri ve ticaret sicil gazetesi belgelerinin tümü zorunludur.");
        return;
      }
    }

    setGonderiliyor(true);
    const supabase = createClient();

    const dosyaYukle = async (dosya: File | null, etiket: string): Promise<string | null> => {
      if (!dosya) return null;
      const yol = `${kullaniciId}/${etiket}-${Date.now()}-${dosyaAdiTemizle(dosya.name)}`;
      const { error } = await supabase.storage.from(BUCKET).upload(yol, dosya, { upsert: false });
      if (error) throw new Error(`${etiket} yüklenemedi: ${error.message}`);
      return yol;
    };

    try {
      const [kimlikOnUrl, kimlikArkaUrl, selfieUrl, imzaSirkuleriUrl, ticaretSicilUrl] = await Promise.all([
        dosyaYukle(kimlikOn, "kimlik-on"),
        dosyaYukle(kimlikArka, "kimlik-arka"),
        dosyaYukle(selfie, "selfie"),
        dosyaYukle(imzaSirkuleri, "imza-sirkuleri"),
        dosyaYukle(ticaretSicil, "ticaret-sicil"),
      ]);

      // Otomatik format kontrolü: TC/vergi no hane sayısı, dosya boyutu/türü
      // zaten yukarıda doğrulandı — hepsi geçtiyse "otomatik_onay_bekliyor",
      // aksi bir durum burada yakalanmışsa (teorik olarak ulaşılmaz, yukarıda
      // return ile kesiliyor) "manuel_inceleme" olarak işaretlenir.
      const otomatikKontrolSonucu = "otomatik_onay_bekliyor";

      const { error: basvuruError } = await supabase.from("kimlik_dogrulama_basvurulari").insert({
        kullanici_id: kullaniciId,
        kisi_turu: kisiTuru,
        ad_soyad: kisiTuru === "bireysel" ? adSoyad.trim() : null,
        firma_adi: kisiTuru === "kurumsal" ? firmaAdi.trim() : null,
        tc_kimlik_no: kisiTuru === "bireysel" ? tcKimlikNo.trim() : null,
        vergi_no: kisiTuru === "kurumsal" ? vergiNo.trim() : null,
        kimlik_on_url: kimlikOnUrl,
        kimlik_arka_url: kimlikArkaUrl,
        selfie_url: selfieUrl,
        imza_sirkuleri_url: imzaSirkuleriUrl,
        ticaret_sicil_url: ticaretSicilUrl,
        otomatik_kontrol_sonucu: otomatikKontrolSonucu,
      });
      if (basvuruError) throw new Error(basvuruError.message);

      await supabase.from("kullanicilar").update({ kisi_turu: kisiTuru }).eq("id", kullaniciId);

      setBasarili(true);
    } catch (err) {
      setHata(err instanceof Error ? err.message : "Başvuru gönderilemedi.");
    } finally {
      setGonderiliyor(false);
    }
  }

  if (!durumYuklendi) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <div className="h-40 bg-white border border-gray-200 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (basarili || mevcutDurum === "onaylandi") {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            {mevcutDurum === "onaylandi" ? "Kimlik doğrulamanız onaylı" : "Başvurunuz alındı"}
          </h1>
          <p className="text-sm text-gray-600 mb-6">
            {mevcutDurum === "onaylandi"
              ? "Kimlik doğrulamanız tamamlandı, ihale açabilir ve teklif verebilirsiniz."
              : "Başvurunuz admin incelemesine alındı. Onaylandığında ihale açabilir ve teklif verebilirsiniz."}
          </p>
          <Link href="/panel" className="inline-block bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-800 transition-colors text-sm">
            Panelime Dön
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-10">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Kimlik Doğrulama</h1>
        <p className="text-gray-500 text-sm mb-6">
          İhale açabilmek veya teklif verebilmek için kimlik/kurum doğrulamanızı tamamlayın.
        </p>

        {mevcutDurum === "reddedildi" && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-6">
            Önceki başvurunuz reddedildi. Bilgilerinizi kontrol edip yeniden gönderin.
          </div>
        )}

        {adim === 1 ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-gray-700 mb-1">Hesap türünüzü seçin</p>
            {([
              ["bireysel", "Bireysel", "TC kimlik numaranız ve kimlik belgelerinizle doğrulama yapılır."],
              ["kurumsal", "Kurumsal", "Firma bilgileriniz ve şirket belgelerinizle doğrulama yapılır."],
            ] as [KisiTuru, string, string][]).map(([deger, etiket, aciklama]) => (
              <button
                key={deger}
                type="button"
                onClick={() => { setKisiTuru(deger); setAdim(2); }}
                className="flex items-start gap-3 px-4 py-4 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50/40 transition-all text-left"
              >
                <span>
                  <span className="block text-sm font-semibold text-gray-900">{etiket}</span>
                  <span className="block text-xs text-gray-500">{aciklama}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <form onSubmit={gonder} className="flex flex-col gap-5">
            <button
              type="button"
              onClick={() => setAdim(1)}
              className="text-xs text-gray-400 hover:text-gray-700 self-start"
            >
              ← Hesap türünü değiştir
            </button>

            {hata && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{hata}</div>
            )}

            {kisiTuru === "bireysel" ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Ad Soyad <span className="text-red-500">*</span></label>
                  <input
                    type="text" required value={adSoyad} onChange={(e) => setAdSoyad(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">TC Kimlik Numarası <span className="text-red-500">*</span></label>
                  <input
                    type="text" inputMode="numeric" required maxLength={11} placeholder="11 haneli TC kimlik no"
                    value={tcKimlikNo} onChange={(e) => setTcKimlikNo(e.target.value.replace(/\D/g, ""))}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <DosyaAlani label="Kimlik Ön Yüz" kabul=".jpg,.jpeg,.png,.pdf" zorunlu dosya={kimlikOn} onChange={setKimlikOn} />
                <DosyaAlani label="Kimlik Arka Yüz" kabul=".jpg,.jpeg,.png,.pdf" zorunlu dosya={kimlikArka} onChange={setKimlikArka} />
                <div>
                  <DosyaAlani label="Selfie (Yüz + Kimlik Birlikte)" kabul=".jpg,.jpeg,.png" zorunlu dosya={selfie} onChange={setSelfie} />
                  <p className="text-xs text-gray-400 mt-1.5">Yüzünüz ve kimlik belgeniz aynı karede, net görünecek şekilde çekilmiş bir fotoğraf yükleyin.</p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Firma Adı <span className="text-red-500">*</span></label>
                  <input
                    type="text" required value={firmaAdi} onChange={(e) => setFirmaAdi(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Vergi Numarası <span className="text-red-500">*</span></label>
                  <input
                    type="text" inputMode="numeric" required maxLength={10} placeholder="10 haneli vergi no"
                    value={vergiNo} onChange={(e) => setVergiNo(e.target.value.replace(/\D/g, ""))}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <DosyaAlani label="İmza Sirküleri" kabul=".pdf" zorunlu dosya={imzaSirkuleri} onChange={setImzaSirkuleri} />
                <DosyaAlani label="Ticaret Sicil Gazetesi" kabul=".pdf" zorunlu dosya={ticaretSicil} onChange={setTicaretSicil} />
              </>
            )}

            <button
              type="submit" disabled={gonderiliyor}
              className="bg-blue-700 text-white font-semibold py-3 rounded-xl hover:bg-blue-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {gonderiliyor ? "Gönderiliyor..." : "Başvuruyu Gönder"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
