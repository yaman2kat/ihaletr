import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { gonderSureUyarisiEmaili, gonderMuteahhitSureUyarisiEmaili } from "@/lib/email";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function tarihFormat(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

// Vercel Cron her 6 saatte bir çağırır (bkz. vercel.json). Son teklif
// tarihine 48 saatten (bitis_tarihi 'date' tipinde olduğu için pratikte
// <= 2 gün) az kalan, henüz uyarılmamış aktif ihaleler için:
//  - ihale sahibine VE o ihaleye teklif vermiş tüm müteahhitlere
//    site-içi bildirim (bildirimler tablosu) yazılır,
//  - e-posta tercihi kapalı olmayan herkese e-posta gönderilir,
//  - son_uyari_gonderildi damgalanarak aynı ihale için tekrar
//    gönderim engellenir.
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
    .is("son_uyari_gonderildi", null)
    .gte("bitis_tarihi", bugunStr)
    .lte("bitis_tarihi", esikStr);

  if (error) {
    console.error("[cron/sure-uyarisi]", error);
    return NextResponse.json({ hata: error.message }, { status: 500 });
  }

  const islenecek = (ihaleler ?? []).filter((i) => i.olusturan_id);
  if (islenecek.length === 0) return NextResponse.json({ islenen: 0 });

  let bildirimSayisi = 0;
  let emailSayisi = 0;

  await Promise.allSettled(
    islenecek.map(async (ihale) => {
      const bitisFormatli = tarihFormat(ihale.bitis_tarihi);

      const [{ data: sahip }, { data: teklifler }] = await Promise.all([
        db.from("kullanicilar").select("id, email, ad_soyad, email_sure_uyarisi").eq("id", ihale.olusturan_id).single(),
        db.from("teklifler").select("kullanici_id").eq("ihale_id", ihale.id),
      ]);

      const teklifVerenIdleri = [...new Set((teklifler ?? []).map((t) => t.kullanici_id))];
      const { data: teklifVerenler } = teklifVerenIdleri.length > 0
        ? await db.from("kullanicilar").select("id, email, ad_soyad, email_sure_uyarisi").in("id", teklifVerenIdleri)
        : { data: [] as { id: string; email: string; ad_soyad: string; email_sure_uyarisi: boolean | null }[] };

      const bildirimSatirlari: {
        kullanici_id: string; tur: string; baslik: string; mesaj: string; link: string; ihale_id: string;
      }[] = [];

      if (sahip) {
        bildirimSatirlari.push({
          kullanici_id: sahip.id, tur: "sure_uyarisi", baslik: "Son 48 Saat",
          mesaj: `İhaleniz "${ihale.baslik}" için son 48 saat! Bitiş tarihi: ${bitisFormatli}`,
          link: `/ihaleler/${ihale.id}`, ihale_id: ihale.id,
        });
      }
      for (const tv of teklifVerenler ?? []) {
        bildirimSatirlari.push({
          kullanici_id: tv.id, tur: "sure_uyarisi", baslik: "Son 48 Saat",
          mesaj: `"${ihale.baslik}" ihalesi için son 48 saat kaldı.`,
          link: `/ihaleler/${ihale.id}`, ihale_id: ihale.id,
        });
      }

      if (bildirimSatirlari.length > 0) {
        const { error: bildirimError } = await db.from("bildirimler").insert(bildirimSatirlari);
        if (!bildirimError) bildirimSayisi += bildirimSatirlari.length;
        else console.error("[cron/sure-uyarisi] bildirim insert", bildirimError);
      }

      const emailGorevleri: Promise<void>[] = [];
      if (sahip?.email && sahip.email_sure_uyarisi !== false) {
        emailGorevleri.push(
          gonderSureUyarisiEmaili({ to: sahip.email, adSoyad: sahip.ad_soyad, ihaleBaslik: ihale.baslik, ihaleId: ihale.id })
        );
      }
      for (const tv of teklifVerenler ?? []) {
        if (tv.email && tv.email_sure_uyarisi !== false) {
          emailGorevleri.push(
            gonderMuteahhitSureUyarisiEmaili({ to: tv.email, adSoyad: tv.ad_soyad, ihaleBaslik: ihale.baslik, ihaleId: ihale.id })
          );
        }
      }
      const sonuclar = await Promise.allSettled(emailGorevleri);
      emailSayisi += sonuclar.filter((s) => s.status === "fulfilled").length;

      await db.from("ihaleler").update({ son_uyari_gonderildi: new Date().toISOString() }).eq("id", ihale.id);
    })
  );

  return NextResponse.json({ islenen: islenecek.length, bildirim: bildirimSayisi, email: emailSayisi });
}
