"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type GercekTeklifErisimDurumu = "yukleniyor" | "tam" | "fiyat" | "kilitli";

export interface TeklifFirma {
  kullanici_id: string;
  tutar: number;
  kullanici_adi: string;
  muteahhit_id?: string;
  ortalamaPuan: number | null;
  yorumSayisi: number;
  durum: "beklemede" | "kabul_edildi" | "reddedildi";
}

interface Sonuc {
  durum: GercekTeklifErisimDurumu;
  fiyatlar: number[];
  firmalar: TeklifFirma[];
}

const BOS_SONUC: Sonuc = { durum: "kilitli", fiyatlar: [], firmalar: [] };

/**
 * Gercek (veritabani) ihaleleri icin teklif erisim kurali:
 * - Ihale devam ederken: hic kimse goremez (sahibi dahil) — "kilitli".
 * - Ihale bittikten sonra:
 *   - Ihale sahibi: TAM erisim (firma adi + tutar + profil linki).
 *   - Kurumsal plan (sahibi degilse): SADECE tutarlar (kimlik bilgisi yok).
 *   - Digerleri (katilimcilar dahil): kilitli.
 */
export function useGercekTeklifErisimi(
  ihaleId: string,
  bittiMi: boolean,
  olusturanId?: string | null
): Sonuc {
  const [sonuc, setSonuc] = useState<Sonuc>({ durum: "yukleniyor", fiyatlar: [], firmalar: [] });

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
          .select("kullanici_id, tutar, durum")
          .eq("ihale_id", ihaleId)
          .order("tutar", { ascending: true });

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
          };
        });

        if (!iptal) setSonuc({ durum: "tam", fiyatlar: firmalar.map((f) => f.tutar), firmalar });
        return;
      }

      let kurumsalMi = false;
      if (uid) {
        const { data } = await supabase.from("kullanicilar").select("plan_turu").eq("id", uid).maybeSingle();
        kurumsalMi = data?.plan_turu === "kurumsal";
      }

      if (kurumsalMi) {
        const { data: fiyatlar } = await supabase.rpc("ihale_teklif_fiyatlari", { p_ihale_id: ihaleId });
        if (!iptal) {
          setSonuc({
            durum: "fiyat",
            fiyatlar: (fiyatlar ?? []).map((r: { tutar: number }) => r.tutar),
            firmalar: [],
          });
        }
        return;
      }

      if (!iptal) setSonuc(BOS_SONUC);
    });

    return () => { iptal = true; };
  }, [ihaleId, bittiMi, olusturanId]);

  return sonuc;
}
