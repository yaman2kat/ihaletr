"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type TeklifErisimDurumu = "yukleniyor" | "izinli" | "kilitli";

interface Params {
  /** İhaleyi oluşturan kullanıcının id'si (varsa). */
  olusturanId?: string | null;
  /** İhaleye verilmiş teklifler (yalnızca kullanici_id alanı okunur). */
  teklifler: { kullanici_id?: string }[];
  /** İhale süresi dolmuş / tamamlanmış mı. */
  bittiMi: boolean;
}

/**
 * En düşük/yüksek teklif bilgisi ve ihale sonuç raporu için erişim kuralı:
 * - İhale sahibi her zaman görebilir.
 * - İhale devam ederken sahibi dışında kimse göremez (plan farketmeksizin).
 * - İhale bittikten sonra: sahibi, o ihaleye teklif vermiş katılımcılar ve
 *   Kurumsal plan kullanıcıları görebilir; diğerleri kilitli görür.
 */
export function useTeklifRaporuErisimi({ olusturanId, teklifler, bittiMi }: Params): TeklifErisimDurumu {
  const [durum, setDurum] = useState<TeklifErisimDurumu>("yukleniyor");

  useEffect(() => {
    let iptalEdildi = false;
    const supabase = createClient();

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (iptalEdildi) return;
      const kullaniciId = session?.user?.id;

      if (kullaniciId && olusturanId && kullaniciId === olusturanId) {
        setDurum("izinli");
        return;
      }

      if (!bittiMi) {
        setDurum("kilitli");
        return;
      }

      if (kullaniciId && teklifler.some((t) => t.kullanici_id === kullaniciId)) {
        setDurum("izinli");
        return;
      }

      if (!kullaniciId) {
        setDurum("kilitli");
        return;
      }

      const { data } = await supabase
        .from("kullanicilar")
        .select("plan_turu")
        .eq("id", kullaniciId)
        .single();

      if (iptalEdildi) return;
      setDurum(data?.plan_turu === "kurumsal" ? "izinli" : "kilitli");
    });

    return () => { iptalEdildi = true; };
    // teklifler referansı çağıran bileşenden prop olarak sabit geldiği için
    // bağımlılıklara dahil edilmedi (her render'da yeniden istek atılmasın diye).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [olusturanId, bittiMi]);

  return durum;
}
