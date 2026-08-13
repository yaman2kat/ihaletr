import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { gonderYeniTeklifEmaili } from "@/lib/email";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// İhaleye yeni teklif verildikten sonra istemci tarafından çağrılır;
// e-posta gönderimi olayın kendisini engellemez (fire-and-forget).
export async function POST(req: NextRequest) {
  try {
    const { ihaleId } = await req.json();
    if (!ihaleId) return NextResponse.json({ hata: "ihaleId zorunlu." }, { status: 400 });

    const db = supabaseAdmin();

    const { data: ihale } = await db
      .from("ihaleler")
      .select("baslik, olusturan_id")
      .eq("id", ihaleId)
      .single();
    if (!ihale?.olusturan_id) return NextResponse.json({ atlandi: true });

    const { data: sonTeklif } = await db
      .from("teklifler")
      .select("tutar, kullanici_id")
      .eq("ihale_id", ihaleId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (!sonTeklif || sonTeklif.kullanici_id === ihale.olusturan_id) {
      return NextResponse.json({ atlandi: true });
    }

    const { data: sahip } = await db
      .from("kullanicilar")
      .select("email, ad_soyad, email_yeni_teklif")
      .eq("id", ihale.olusturan_id)
      .single();
    if (!sahip?.email || sahip.email_yeni_teklif === false) {
      return NextResponse.json({ atlandi: true });
    }

    await gonderYeniTeklifEmaili({
      to: sahip.email,
      adSoyad: sahip.ad_soyad,
      ihaleBaslik: ihale.baslik,
      ihaleId,
      tutar: sonTeklif.tutar,
    });

    return NextResponse.json({ basarili: true });
  } catch (err) {
    console.error("[api/email/yeni-teklif]", err);
    return NextResponse.json({ hata: "Sunucu hatası." }, { status: 500 });
  }
}
