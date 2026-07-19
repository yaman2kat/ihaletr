"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { mockMuteahhitYorumlar, type MockTeklif } from "@/lib/mock-data";
import type { PlanTuru } from "@/lib/types";
import {
  type IhaleSonucVerisi,
  type SonucFirma,
  ozetIstatistikHesapla,
  formatPara,
  formatTarih,
  PLAN_UZATMA_LIMITI,
  gunFarki,
  tarihiGunEkleyerekUzat,
} from "@/lib/ihale-sonuc";
import { ihaleSonucExcelOlustur } from "@/lib/ihale-sonuc-excel";
import { ihaleSonucWordOlustur } from "@/lib/ihale-sonuc-word";
import { ihaleSonucPdfDosyasiOlustur } from "@/lib/ihale-sonuc-pdf";

interface Props {
  ihale: {
    id: string;
    baslik: string;
    kurum: string;
    baslangic_tarihi: string;
    bitis_tarihi: string;
  };
  teklifler: MockTeklif[];
}

function dosyaIndir(blob: Blob, dosyaAdi: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = dosyaAdi;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function IndirButonu({ etiket, onIndir }: { etiket: string; onIndir: () => Promise<Blob> }) {
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState(false);

  async function tikla() {
    setYukleniyor(true);
    setHata(false);
    try {
      const blob = await onIndir();
      dosyaIndir(blob, `ihale-sonuc-raporu.${etiket === "Excel" ? "xlsx" : etiket === "Word" ? "docx" : "pdf"}`);
    } catch (e) {
      console.error("rapor indirme hatası", e);
      setHata(true);
    } finally {
      setYukleniyor(false);
    }
  }

  return (
    <button
      type="button"
      onClick={tikla}
      disabled={yukleniyor}
      className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 whitespace-nowrap ${
        hata
          ? "border-red-200 text-red-600"
          : "border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-blue-300 hover:text-blue-700"
      }`}
    >
      {yukleniyor ? "…" : hata ? "Hata, tekrar dene" : etiket}
    </button>
  );
}

function UzatmaBolumu({
  ihaleId, baslangicTarihi, bitisTarihi,
}: { ihaleId: string; baslangicTarihi: string; bitisTarihi: string }) {
  const [acikMi, setAcikMi] = useState(false);
  const [planTuru, setPlanTuru] = useState<PlanTuru | null | undefined>(undefined);
  const [gun, setGun] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [hata, setHata] = useState("");
  const [basariliTarih, setBasariliTarih] = useState<string | null>(null);

  useEffect(() => {
    if (!acikMi) return;
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { setPlanTuru(null); return; }
      const { data } = await supabase
        .from("kullanicilar")
        .select("plan_turu")
        .eq("id", session.user.id)
        .single();
      setPlanTuru((data?.plan_turu as PlanTuru | undefined) ?? null);
    });
  }, [acikMi]);

  const gecenGun = gunFarki(baslangicTarihi, bitisTarihi);
  const planLimiti = planTuru ? PLAN_UZATMA_LIMITI[planTuru] ?? 0 : 0;
  const kalanUzatmaHakki = Math.max(0, planLimiti - gecenGun);

  async function uzat() {
    setHata("");
    const eklenecekGun = Number(gun);
    if (!eklenecekGun || eklenecekGun <= 0) { setHata("Geçerli bir gün sayısı girin."); return; }
    if (eklenecekGun > kalanUzatmaHakki) { setHata(`En fazla ${kalanUzatmaHakki} gün uzatabilirsiniz.`); return; }

    setGonderiliyor(true);
    const yeniBitisTarihi = tarihiGunEkleyerekUzat(bitisTarihi, eklenecekGun);
    const supabase = createClient();
    const { error } = await supabase
      .from("ihaleler")
      .update({ bitis_tarihi: yeniBitisTarihi })
      .eq("id", ihaleId);
    setGonderiliyor(false);

    if (error) { setHata("İhale uzatılamadı: " + error.message); return; }
    setBasariliTarih(yeniBitisTarihi);
  }

  if (!acikMi) {
    return (
      <button
        type="button"
        onClick={() => setAcikMi(true)}
        className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-700 font-medium py-2.5 rounded-xl hover:bg-gray-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
      >
        İhaleyi Uzat
      </button>
    );
  }

  if (basariliTarih) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center text-sm text-green-700">
        İhale başarıyla uzatıldı. Yeni son teklif tarihi: <strong>{formatTarih(basariliTarih)}</strong>
      </div>
    );
  }

  if (planTuru === undefined) {
    return <div className="h-20 bg-gray-50 rounded-xl animate-pulse" />;
  }

  if (planLimiti === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
        <p className="text-sm text-amber-800 mb-2">İhale uzatma, Premium ve Kurumsal planlarda kullanılabilir.</p>
        <Link href="/premium" className="text-sm font-semibold text-amber-700 hover:underline">Plana Geç →</Link>
      </div>
    );
  }

  if (kalanUzatmaHakki <= 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center text-sm text-gray-500">
        Bu ihale, planınızın izin verdiği toplam {planLimiti} günlük süreye zaten ulaştı.
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4">
      <p className="text-sm text-gray-600 mb-3">
        Planınız (<strong>{planTuru === "kurumsal" ? "Kurumsal" : "Premium"}</strong>) toplamda en fazla{" "}
        {planLimiti} gün ihale süresine izin verir. Bu ihale şu ana kadar {gecenGun} gün sürdü;
        en fazla <strong>{kalanUzatmaHakki} gün</strong> daha uzatabilirsiniz.
      </p>
      {hata && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-2.5 mb-3">{hata}</div>
      )}
      <div className="flex gap-2">
        <input
          type="number"
          min={1}
          max={kalanUzatmaHakki}
          value={gun}
          onChange={(e) => setGun(e.target.value)}
          placeholder={`1-${kalanUzatmaHakki} gün`}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          disabled={gonderiliyor}
          onClick={uzat}
          className="bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg text-sm hover:bg-blue-800 disabled:opacity-50 transition-colors"
        >
          {gonderiliyor ? "Uzatılıyor..." : "Uzat"}
        </button>
      </div>
    </div>
  );
}

export default function IhaleSonucRaporu({ ihale, teklifler }: Props) {
  const [acikMi, setAcikMi] = useState(false);

  if (teklifler.length === 0) return null;

  const firmalar: SonucFirma[] = teklifler.map((t) => {
    const yorumlar = t.muteahhit_id
      ? mockMuteahhitYorumlar.filter((y) => y.muteahhit_id === t.muteahhit_id)
      : [];
    const ortalamaPuan = yorumlar.length
      ? yorumlar.reduce((s, y) => s + y.puan, 0) / yorumlar.length
      : null;
    return {
      firmaAdi: t.kullanici_adi,
      tutar: t.tutar ?? 0,
      muteahhitId: t.muteahhit_id,
      ortalamaPuan,
      yorumSayisi: yorumlar.length,
    };
  });

  const veri: IhaleSonucVerisi = {
    ihaleId: ihale.id,
    ihaleBaslik: ihale.baslik,
    kurum: ihale.kurum,
    baslangicTarihi: ihale.baslangic_tarihi,
    bitisTarihi: ihale.bitis_tarihi,
    firmalar,
  };

  const ozet = ozetIstatistikHesapla(firmalar);
  const siraliFirmalar = [...firmalar].sort((a, b) => a.tutar - b.tutar);
  const uzatmaGosterilsinMi = firmalar.length < 7;

  return (
    <>
      <button
        type="button"
        onClick={() => setAcikMi(true)}
        className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white font-semibold py-3 rounded-xl hover:bg-gray-800 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 17V9m4 8V5m4 12v-4M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        İhale Sonucunu Göster
      </button>

      {acikMi && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            {/* Başlık + indirme butonları */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between gap-4 rounded-t-2xl">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-gray-900">İhale Sonuç Raporu</h2>
                <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{ihale.baslik}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <IndirButonu etiket="Excel" onIndir={() => ihaleSonucExcelOlustur(veri)} />
                <IndirButonu etiket="PDF" onIndir={() => ihaleSonucPdfDosyasiOlustur(veri)} />
                <IndirButonu etiket="Word" onIndir={() => ihaleSonucWordOlustur(veri)} />
                <button
                  type="button"
                  onClick={() => setAcikMi(false)}
                  className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                  aria-label="Kapat"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="px-6 py-5 flex flex-col gap-6">
              {/* Teklif tablosu */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                      <th className="py-2 pr-3 font-medium">Firma</th>
                      <th className="py-2 pr-3 font-medium">Teklif Tutarı</th>
                      <th className="py-2 pr-3 font-medium">Ortalama Puan</th>
                      <th className="py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {siraliFirmalar.map((f, i) => (
                      <tr key={i}>
                        <td className="py-3 pr-3 font-medium text-gray-900">{f.firmaAdi}</td>
                        <td className="py-3 pr-3 text-gray-700 whitespace-nowrap">{formatPara(f.tutar)}</td>
                        <td className="py-3 pr-3 text-gray-700 whitespace-nowrap">
                          {f.ortalamaPuan !== null
                            ? `${f.ortalamaPuan.toFixed(1)} ★ (${f.yorumSayisi})`
                            : <span className="text-gray-400">Henüz değerlendirme yok</span>}
                        </td>
                        <td className="py-3">
                          {f.muteahhitId ? (
                            <Link
                              href={`/muteahhit/${f.muteahhitId}#yorumlar`}
                              className="text-blue-700 text-xs font-semibold hover:underline whitespace-nowrap"
                            >
                              Yorumları Oku →
                            </Link>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Özet istatistikler */}
              {ozet && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-red-50 rounded-xl p-4 text-center">
                    <p className="text-xs text-red-500 mb-1">En Yüksek Teklif</p>
                    <p className="font-bold text-red-700">{formatPara(ozet.enYuksek)}</p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-4 text-center">
                    <p className="text-xs text-green-600 mb-1">En Düşük Teklif</p>
                    <p className="font-bold text-green-700">{formatPara(ozet.enDusuk)}</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-4 text-center">
                    <p className="text-xs text-blue-500 mb-1">Ortalama Teklif</p>
                    <p className="font-bold text-blue-700">{formatPara(Math.round(ozet.ortalama))}</p>
                  </div>
                </div>
              )}

              {/* İhaleyi Uzat — sadece 7'den az firma teklif verdiyse */}
              {uzatmaGosterilsinMi && (
                <UzatmaBolumu
                  ihaleId={ihale.id}
                  baslangicTarihi={ihale.baslangic_tarihi}
                  bitisTarihi={ihale.bitis_tarihi}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
