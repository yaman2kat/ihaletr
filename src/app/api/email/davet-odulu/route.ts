import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { gonderDavetOduluEmaili } from "@/lib/email";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// "davet_odulu_uygula" RPC'si başarılı olduktan sonra istemci tarafından
// çağrılır.
export async function POST(req: NextRequest) {
  try {
    const { davetEdenId, odulTuru, ihaleId } = await req.json();
    if (!davetEdenId || (odulTuru !== "teklif_hakki" && odulTuru !== "sure_uzatma")) {
      return NextResponse.json({ hata: "Geçersiz parametreler." }, { status: 400 });
    }

    const db = supabaseAdmin();

    const { data: davetEden } = await db
      .from("kullanicilar")
      .select("email, ad_soyad, email_davet_odulu")
      .eq("id", davetEdenId)
      .single();
    if (!davetEden?.email || davetEden.email_davet_odulu === false) {
      return NextResponse.json({ atlandi: true });
    }

    let ihaleBaslik: string | undefined;
    if (odulTuru === "sure_uzatma" && ihaleId) {
      const { data: ihale } = await db.from("ihaleler").select("baslik").eq("id", ihaleId).single();
      ihaleBaslik = ihale?.baslik;
    }

    await gonderDavetOduluEmaili({
      to: davetEden.email, adSoyad: davetEden.ad_soyad, odulTuru, ihaleBaslik,
    });

    return NextResponse.json({ basarili: true });
  } catch (err) {
    console.error("[api/email/davet-odulu]", err);
    return NextResponse.json({ hata: "Sunucu hatası." }, { status: 500 });
  }
}
