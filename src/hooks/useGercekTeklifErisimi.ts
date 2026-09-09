"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type GercekTeklifErisimDurumu = "yukleniyor" | "tam" | "maskeli" | "kilitli";

export interface TeklifFirma {
  /** Yalnizca "tam" (ihale sahibi) icin dolu -- "maskeli" satirlar
   * deanonimlestirmeyi imkansiz kilmak icin hicbir kimlik alani tasimaz. */
  kullanici_id?: string;
  muteahhit_id?: string;
  /** Dosya tabanlı (Kat Karşılığı/Kentsel Dönüşüm) tekliflerde null. */
  tutar: number | null;
  kullanici_adi: string;
  ortalamaPuan: number | null;
  yorumSayisi: number;
  durum?: "beklemede" | "kabul_edildi" | "reddedildi";
  /** Sunucu tarafında hesaplanmış "bu teklif kazandı mı" bayrağı --
   * maskeli tier'da kullanici_id/durum hiç dönmediği için kazanan satırı
   * bununla bulunur (tutar eşleşmesi dosya türü tekliflerde çalışmaz). */
  kazandiMi?: boolean;
  teklifTuru?: "nakit" | "dosya";
  teklifDosyasiPath?: string | null;
  alternatifProjePath?: string | null;
}

interface Sonuc {
  durum: GercekTeklifErisimDurumu;
  firmalar: TeklifFirma[];
  /** Kazanan teklifin tutari -- yalnizca kazanan secilmisse VE goruntuleyen
   * yetkiliyse (sahibi/katilimci/kurumsal) dolu. */
  kazananFiyat: number | null;
  /** Kimlik icermez -- kilitli goruntude "kazanan secildi ama sen goremezsin"
   * ile "henuz kazanan yok" ayrimini yapmak icin (CTA gosterme karari). */
  kazananVarMi: boolean;
}

const BOS_SONUC: Sonuc = { durum: "kilitli", firmalar: [], kazananFiyat: null, kazananVarMi: false };

/**
 * Gercek (veritabani) ihaleleri icin teklif erisim kurali:
 * - Ihale devam ederken: hic kimse goremez (sahibi dahil) — "kilitli".
 * - Ihale bittikten sonra:
 *   - Ihale sahibi: TAM erisim (gercek firma adi + tutar + profil linki).
 *   - Katilimcilar (bu ihaleye teklif vermis olanlar) ve Kurumsal plan
 *     sahipleri: MASKELI erisim (isimler "Y***** İ***** A.Ş." seklinde
 *     maskelenir, kullanici_id/profil linki hic donmez).
 *   - Digerleri: kilitli.
 */
export function useGercekTeklifErisimi(
  ihaleId: string,
  bittiMi: boolean,
  olusturanId?: string | null
): Sonuc {
  const [sonuc, setSonuc] = useState<Sonuc>({ durum: "yukleniyor", firmalar: [], kazananFiyat: null, kazananVarMi: false });

  useEffect(() => {
    let iptal = false;
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (iptal) return;
      if (!bittiMi) { setSonuc(BOS_SONUC); return; }

      const uid = session?.user?.id;

      if (uid && olusturanId && uid === olusturanId) {
        const { data: teklifler } = await supabase
          .from("teklifler")
          .select("kullanici_id, tutar, durum, teklif_turu, teklif_dosyasi_url, alternatif_proje_url")
          .eq("ihale_id", ihaleId)
          .order("tutar", { ascending: true, nullsFirst: false });

        const idler = [...new Set((teklifler ?? []).map((t) => t.kullanici_id))];
        const { data: kullanicilar } = idler.length > 0
          ? await supabase.from("kullanicilar_ozet").select("id, ad_soyad, firma_adi").in("id", idler)
          : { data: [] as { id: string; ad_soyad: string; firma_adi: string | null }[] };
        const { data: muteahhitler } = idler.length > 0
          ? await supabase.from("muteahhit_profiller").select("kullanici_id").in("kullanici_id", idler)
          : { data: [] as { kullanici_id: string }[] };
        const muteahhitIdSeti = new Set((muteahhitler ?? []).map((m) => m.kullanici_id));
        const harita = new Map((kullanicilar ?? []).map((k) => [k.id, k]));

        const { data: yorumlar } = muteahhitIdSeti.size > 0
          ? await supabase.from("muteahhit_yorumlar").select("muteahhit_id, puan").in("muteahhit_id", [...muteahhitIdSeti])
          : { data: [] as { muteahhit_id: string; puan: number }[] };
        const yorumHarita = new Map<string, number[]>();
        for (const y of yorumlar ?? []) {
          const liste = yorumHarita.get(y.muteahhit_id) ?? [];
          liste.push(y.puan);
          yorumHarita.set(y.muteahhit_id, liste);
        }

        const firmalar: TeklifFirma[] = (teklifler ?? []).map((t) => {
          const puanlar = yorumHarita.get(t.kullanici_id) ?? [];
          return {
            kullanici_id: t.kullanici_id,
            tutar: t.tutar,
            kullanici_adi: harita.get(t.kullanici_id)?.firma_adi || harita.get(t.kullanici_id)?.ad_soyad || "Kullanıcı",
            muteahhit_id: muteahhitIdSeti.has(t.kullanici_id) ? t.kullanici_id : undefined,
            ortalamaPuan: puanlar.length ? puanlar.reduce((a, b) => a + b, 0) / puanlar.length : null,
            yorumSayisi: puanlar.length,
            durum: t.durum,
            kazandiMi: t.durum === "kabul_edildi",
            teklifTuru: t.teklif_turu,
            teklifDosyasiPath: t.teklif_dosyasi_url,
            alternatifProjePath: t.alternatif_proje_url,
          };
        });

        const kazanan = firmalar.find((f) => f.durum === "kabul_edildi");
        if (!iptal) {
          setSonuc({
            durum: "tam",
            firmalar,
            kazananFiyat: kazanan?.tutar ?? null,
            kazananVarMi: !!kazanan,
          });
        }
        return;
      }

      let maskeliMi = false;
      if (uid) {
        if (!maskeliMi) {
          const { data: kendiTeklifi } = await supabase
            .from("teklifler").select("id").eq("ihale_id", ihaleId).eq("kullanici_id", uid).maybeSingle();
          maskeliMi = !!kendiTeklifi;
        }
        if (!maskeliMi) {
          const { data } = await supabase.from("kullanicilar").select("plan_turu").eq("id", uid).maybeSingle();
          maskeliMi = data?.plan_turu === "kurumsal";
        }
      }

      if (maskeliMi) {
        const [{ data: liste }, { data: kazananFiyatData }, { data: kazananVarMiData }] = await Promise.all([
          supabase.rpc("ihale_teklif_listesi_maskeli", { p_ihale_id: ihaleId }),
          supabase.rpc("ihale_kazanan_fiyat", { p_ihale_id: ihaleId }),
          supabase.rpc("ihale_kazanan_var_mi", { p_ihale_id: ihaleId }),
        ]);
        const firmalar: TeklifFirma[] = (liste ?? []).map((r: {
          isim_maskeli: string; tutar: number | null; ortalama_puan: number | null; yorum_sayisi: number;
          teklif_turu?: "nakit" | "dosya"; teklif_dosyasi_url?: string | null; alternatif_proje_url?: string | null;
          kazandi_mi?: boolean;
        }) => ({
          tutar: r.tutar,
          kullanici_adi: r.isim_maskeli,
          ortalamaPuan: r.ortalama_puan,
          yorumSayisi: r.yorum_sayisi,
          kazandiMi: r.kazandi_mi,
          teklifTuru: r.teklif_turu,
          teklifDosyasiPath: r.teklif_dosyasi_url,
          alternatifProjePath: r.alternatif_proje_url,
        }));
        const kazananFiyat = kazananFiyatData?.[0]?.tutar ?? null;
        if (!iptal) {
          setSonuc({ durum: "maskeli", firmalar, kazananFiyat, kazananVarMi: !!kazananVarMiData });
        }
        return;
      }

      const { data: varMi } = await supabase.rpc("ihale_kazanan_var_mi", { p_ihale_id: ihaleId });
      if (!iptal) setSonuc({ durum: "kilitli", firmalar: [], kazananFiyat: null, kazananVarMi: !!varMi });
    });

    return () => { iptal = true; };
  }, [ihaleId, bittiMi, olusturanId]);

  return sonuc;
}
