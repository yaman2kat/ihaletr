"use client";

import { useState } from "react";
import {
  TasinmazBilgisi,
  SozlesmeFormVerisi,
  VARSAYILAN_TEKNIK_SARTNAME,
  olusturSozlesmeMetni,
} from "@/lib/sozlesme";
import { sozlesmePdfDosyasiOlustur } from "@/lib/sozlesme-pdf";

interface Props {
  tasinmaz: TasinmazBilgisi;
  arsaSahibiAdSoyadOnerilen: string;
  onKapat: () => void;
  onOlustur: (dosya: File) => void;
}

const inputSinif =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm";
const etiketSinif = "block text-xs font-medium text-gray-600 mb-1.5";

export default function SozlesmeModal({ tasinmaz, arsaSahibiAdSoyadOnerilen, onKapat, onOlustur }: Props) {
  const [form, setForm] = useState<SozlesmeFormVerisi>({
    muteahhit: { unvanAdSoyad: "", tcVeyaVergiNo: "", adres: "" },
    arsaSahipleri: [{ adSoyad: arsaSahibiAdSoyadOnerilen, tcKimlikNo: "", adres: "" }],
    tasinmaz,
    paylasim: { arsaSahibiOrani: "45", muteahhitOrani: "55" },
    sure: { ruhsatSuresiAy: "6", insaatSuresiAy: "18", gecikmeCezasiKatSayisi: "2" },
    teknikSartname: VARSAYILAN_TEKNIK_SARTNAME.map((k) => ({ ...k })),
    yetkiliMahkemeIli: tasinmaz.il,
  });
  const [olusturuluyor, setOlusturuluyor] = useState(false);
  const [hata, setHata] = useState("");

  const arsaSahibi = form.arsaSahipleri[0];

  function arsaSahibiGuncelle(alan: "adSoyad" | "tcKimlikNo" | "adres", deger: string) {
    setForm((f) => ({
      ...f,
      arsaSahipleri: [{ ...f.arsaSahipleri[0], [alan]: deger }],
    }));
  }

  function paylasimGuncelle(arsaOrani: string) {
    const sayi = Math.max(0, Math.min(100, Number(arsaOrani) || 0));
    setForm((f) => ({
      ...f,
      paylasim: { arsaSahibiOrani: String(sayi), muteahhitOrani: String(100 - sayi) },
    }));
  }

  function sureGuncelle(alan: keyof SozlesmeFormVerisi["sure"], deger: string) {
    setForm((f) => ({ ...f, sure: { ...f.sure, [alan]: deger } }));
  }

  function sartnameGuncelle(anahtar: string, degisiklik: Partial<{ dahil: boolean; deger: string }>) {
    setForm((f) => ({
      ...f,
      teknikSartname: f.teknikSartname.map((k) => (k.anahtar === anahtar ? { ...k, ...degisiklik } : k)),
    }));
  }

  async function olustur() {
    setHata("");
    if (!arsaSahibi.adSoyad.trim() || !arsaSahibi.tcKimlikNo.trim()) {
      setHata("Arsa sahibi ad-soyad ve T.C. kimlik no zorunludur.");
      return;
    }
    setOlusturuluyor(true);
    try {
      const metin = olusturSozlesmeMetni(form);
      const dosya = await sozlesmePdfDosyasiOlustur(metin);
      onOlustur(dosya);
    } catch (e) {
      console.error("sozlesme pdf hata", e);
      setHata("Sözleşme PDF'i oluşturulurken bir hata oluştu.");
    } finally {
      setOlusturuluyor(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Sözleşme Hazırla</h2>
            <p className="text-xs text-gray-500 mt-0.5">Kat Karşılığı İnşaat Sözleşmesi taslağı</p>
          </div>
          <button
            type="button"
            onClick={onKapat}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="Kapat"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">
          {/* Taşınmaz bilgileri — ihale formundan otomatik dolduruldu */}
          <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
            <p className="text-sm font-semibold text-gray-700 mb-3">
              Taşınmaz Bilgileri <span className="text-gray-400 font-normal">(ihale formundan alındı)</span>
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
              <div><span className="text-gray-400">İl:</span> <span className="text-gray-900">{tasinmaz.il || "—"}</span></div>
              <div><span className="text-gray-400">İlçe:</span> <span className="text-gray-900">{tasinmaz.ilce || "—"}</span></div>
              <div><span className="text-gray-400">Mahalle:</span> <span className="text-gray-900">{tasinmaz.mahalle || "—"}</span></div>
              <div><span className="text-gray-400">Ada No:</span> <span className="text-gray-900">{tasinmaz.ada || "—"}</span></div>
              <div><span className="text-gray-400">Parsel No:</span> <span className="text-gray-900">{tasinmaz.parsel || "—"}</span></div>
              <div><span className="text-gray-400">m²:</span> <span className="text-gray-900">{tasinmaz.m2 || "—"}</span></div>
              <div className="col-span-2 sm:col-span-3"><span className="text-gray-400">İhale Türü:</span> <span className="text-gray-900">{tasinmaz.ihaleTuru || "—"}</span></div>
            </div>
          </div>

          {/* Arsa sahibi */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">Arsa Sahibi</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={etiketSinif}>Ad Soyad <span className="text-red-500">*</span></label>
                <input
                  type="text" value={arsaSahibi.adSoyad}
                  onChange={(e) => arsaSahibiGuncelle("adSoyad", e.target.value)}
                  className={inputSinif}
                />
              </div>
              <div>
                <label className={etiketSinif}>T.C. Kimlik No <span className="text-red-500">*</span></label>
                <input
                  type="text" inputMode="numeric" maxLength={11} value={arsaSahibi.tcKimlikNo}
                  onChange={(e) => arsaSahibiGuncelle("tcKimlikNo", e.target.value.replace(/\D/g, ""))}
                  className={inputSinif}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={etiketSinif}>Adres</label>
                <input
                  type="text" value={arsaSahibi.adres}
                  onChange={(e) => arsaSahibiGuncelle("adres", e.target.value)}
                  className={inputSinif}
                />
              </div>
            </div>
          </div>

          {/* Paylaşım oranı */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">Paylaşım Oranı</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={etiketSinif}>Arsa Sahibi Payı (%)</label>
                <input
                  type="number" min={0} max={100} value={form.paylasim.arsaSahibiOrani}
                  onChange={(e) => paylasimGuncelle(e.target.value)}
                  className={inputSinif}
                />
              </div>
              <div>
                <label className={etiketSinif}>Müteahhit Payı (%)</label>
                <input type="number" value={form.paylasim.muteahhitOrani} disabled className={`${inputSinif} bg-gray-50 text-gray-500`} />
              </div>
            </div>
          </div>

          {/* Süreler */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">Süreler ve Cezai Şart</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={etiketSinif}>Ruhsat Süresi (ay)</label>
                <input
                  type="number" min={0} value={form.sure.ruhsatSuresiAy}
                  onChange={(e) => sureGuncelle("ruhsatSuresiAy", e.target.value)}
                  className={inputSinif}
                />
              </div>
              <div>
                <label className={etiketSinif}>İnşaat Süresi (ay)</label>
                <input
                  type="number" min={0} value={form.sure.insaatSuresiAy}
                  onChange={(e) => sureGuncelle("insaatSuresiAy", e.target.value)}
                  className={inputSinif}
                />
              </div>
              <div>
                <label className={etiketSinif}>Gecikme Cezası Katsayısı</label>
                <input
                  type="number" min={0} value={form.sure.gecikmeCezasiKatSayisi}
                  onChange={(e) => sureGuncelle("gecikmeCezasiKatSayisi", e.target.value)}
                  className={inputSinif}
                />
              </div>
            </div>
          </div>

          {/* Teknik şartname */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">Teknik Şartname</p>
            <div className="flex flex-col gap-2">
              {form.teknikSartname.map((k) => (
                <div key={k.anahtar} className="flex items-start gap-3 border border-gray-100 rounded-lg p-2.5">
                  <input
                    type="checkbox" checked={k.dahil}
                    onChange={(e) => sartnameGuncelle(k.anahtar, { dahil: e.target.checked })}
                    className="mt-1.5 w-4 h-4 text-blue-600 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 mb-1">{k.etiket}</p>
                    <input
                      type="text" value={k.deger} disabled={!k.dahil}
                      onChange={(e) => sartnameGuncelle(k.anahtar, { deger: e.target.value })}
                      className={`${inputSinif} text-xs py-1.5 ${!k.dahil ? "bg-gray-50 text-gray-400" : ""}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Yetkili mahkeme */}
          <div>
            <label className={etiketSinif}>Yetkili Mahkeme İli</label>
            <input
              type="text" value={form.yetkiliMahkemeIli}
              onChange={(e) => setForm((f) => ({ ...f, yetkiliMahkemeIli: e.target.value }))}
              className={inputSinif}
            />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
            Bu belge taslaktır, hukuki geçerlilik kazanması için noter huzurunda düzenlenmesi gerekir.
          </div>

          {hata && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{hata}</div>}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex gap-3 rounded-b-2xl">
          <button
            type="button" onClick={onKapat}
            className="flex-1 border border-gray-200 text-gray-700 font-medium py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Vazgeç
          </button>
          <button
            type="button" onClick={olustur} disabled={olusturuluyor}
            className="flex-1 bg-blue-700 text-white font-semibold py-2.5 rounded-xl hover:bg-blue-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {olusturuluyor ? "Oluşturuluyor..." : "Sözleşmeyi Oluştur ve Ekle"}
          </button>
        </div>
      </div>
    </div>
  );
}
