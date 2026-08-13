import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { gonderSureUyarisiEmaili } from "@/lib/email";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// Vercel Cron her gün çağırır (bkz. vercel.json). Son teklif tarihine
// 48 saatten (bitis_tarihi 'date' tipinde olduğu için pratikte <= 2 gün)
// az kalan, henüz uyarılmamış aktif ihalelerin sahiplerine e-posta gönderir
// ve "sure_uyarisi_gonderildi" bayrağını işaretleyerek tekrar göndermeyi
// engeller.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ hata: "Yetkisiz." }, { status: 401 });
  }

  const db = supabaseAdmin();

  const bugun = new Date();
  const esikTarih = new Date(bugun);
  esikTarih.setDate(esikTarih.getDate() + 2);
  const bugunStr = bugun.toISOString().slice(0, 10);
  const esikStr = esikTarih.toISOString().slice(0, 10);

  const { data: ihaleler, error } = await db
    .from("ihaleler")
    .select("id, baslik, olusturan_id, bitis_tarihi")
    .eq("durum", "aktif")
    .eq("inceleme_durumu", "onaylandi")
    .eq("otomatik_sonlandirildi", false)
    .eq("sure_uyarisi_gonderildi", false)
    .gte("bitis_tarihi", bugunStr)
    .lte("bitis_tarihi", esikStr);

  if (error) {
    console.error("[cron/sure-uyarisi]", error);
    return NextResponse.json({ hata: error.message }, { status: 500 });
  }

  const gonderilecek = (ihaleler ?? []).filter((i) => i.olusturan_id);
  if (gonderilecek.length === 0) return NextResponse.json({ islenen: 0 });

  const sahipIdleri = [...new Set(gonderilecek.map((i) => i.olusturan_id as string))];
  const { data: sahipler } = await db
    .from("kullanicilar")
    .select("id, email, ad_soyad, email_sure_uyarisi")
    .in("id", sahipIdleri);
  const sahipHarita = new Map((sahipler ?? []).map((s) => [s.id, s]));

  let gonderilen = 0;
  await Promise.allSettled(
    gonderilecek.map(async (ihale) => {
      const sahip = sahipHarita.get(ihale.olusturan_id as string);
      if (sahip?.email && sahip.email_sure_uyarisi !== false) {
        await gonderSureUyarisiEmaili({
          to: sahip.email, adSoyad: sahip.ad_soyad, ihaleBaslik: ihale.baslik, ihaleId: ihale.id,
        });
        gonderilen++;
      }
      await db.from("ihaleler").update({ sure_uyarisi_gonderildi: true }).eq("id", ihale.id);
    })
  );

  return NextResponse.json({ islenen: gonderilecek.length, gonderilen });
}
