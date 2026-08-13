import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  gonderIhaleOnaylandiEmaili,
  gonderIhaleReddedildiEmaili,
  gonderBolgeEslesmesiEmaili,
} from "@/lib/email";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// Admin bir ihaleyi onayladıktan/reddettikten sonra istemci tarafından
// çağrılır. Onay durumunda ayrıca bölge eşleşmesi e-postaları gönderilir.
export async function POST(req: NextRequest) {
  try {
    const { ihaleId, durum } = await req.json();
    if (!ihaleId || (durum !== "onaylandi" && durum !== "reddedildi")) {
      return NextResponse.json({ hata: "Geçersiz parametreler." }, { status: 400 });
    }

    const db = supabaseAdmin();

    const { data: ihale } = await db
      .from("ihaleler")
      .select("baslik, olusturan_id, sehir, ilce, red_sebebi")
      .eq("id", ihaleId)
      .single();
    if (!ihale?.olusturan_id) return NextResponse.json({ atlandi: true });

    const { data: sahip } = await db
      .from("kullanicilar")
      .select("email, ad_soyad, email_ihale_durumu")
      .eq("id", ihale.olusturan_id)
      .single();

    if (sahip?.email && sahip.email_ihale_durumu !== false) {
      if (durum === "onaylandi") {
        await gonderIhaleOnaylandiEmaili({
          to: sahip.email, adSoyad: sahip.ad_soyad, ihaleBaslik: ihale.baslik, ihaleId,
        });
      } else {
        await gonderIhaleReddedildiEmaili({
          to: sahip.email, adSoyad: sahip.ad_soyad, ihaleBaslik: ihale.baslik,
          redSebebi: ihale.red_sebebi ?? "Belirtilmemiş.",
        });
      }
    }

    if (durum === "onaylandi") {
      const { data: muteahhitler } = await db
        .from("muteahhit_profiller")
        .select("kullanici_id")
        .contains("calistigi_iller", [ihale.sehir]);

      const hedefIdler = (muteahhitler ?? [])
        .map((m) => m.kullanici_id)
        .filter((id) => id !== ihale.olusturan_id);

      if (hedefIdler.length > 0) {
        const { data: alicilar } = await db
          .from("kullanicilar")
          .select("id, email, ad_soyad, email_bolge_eslesmesi")
          .in("id", hedefIdler);

        await Promise.allSettled(
          (alicilar ?? [])
            .filter((a) => a.email && a.email_bolge_eslesmesi !== false)
            .map((a) =>
              gonderBolgeEslesmesiEmaili({
                to: a.email, adSoyad: a.ad_soyad,
                sehir: ihale.sehir, ilce: ihale.ilce,
                ihaleBaslik: ihale.baslik, ihaleId,
              })
            )
        );
      }
    }

    return NextResponse.json({ basarili: true });
  } catch (err) {
    console.error("[api/email/ihale-durumu]", err);
    return NextResponse.json({ hata: "Sunucu hatası." }, { status: 500 });
  }
}
