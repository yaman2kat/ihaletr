import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { gonderTeklifIkaziEmaili } from "@/lib/email";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// Admin, "Sorgulanan Teklifler" panelinden bir bildirim icin ikaz
// gonderdiginde cagrilir. Bu route hem e-posta gonderiyor hem
// ikaz_gonderildi/durum alanlarini kesinlestiriyor (service-role ile) --
// bu yuzden odeme route'undaki gibi oturumu SUNUCU TARAFINDA admin
// olarak dogrulamak sart (istemci tarafi "admin" kontrolu bir guvenlik
// siniri degildir).
export async function POST(req: NextRequest) {
  try {
    const sessionSupabase = await createSessionClient();
    const { data: { user } } = await sessionSupabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ hata: "Oturum bulunamadı." }, { status: 401 });
    }

    const db = supabaseAdmin();

    const { data: profil } = await db.from("kullanicilar").select("rol").eq("id", user.id).single();
    if (profil?.rol !== "admin") {
      return NextResponse.json({ hata: "Bu işlem için admin yetkisi gereklidir." }, { status: 403 });
    }

    const { bildirimId } = await req.json();
    if (!bildirimId) {
      return NextResponse.json({ hata: "Geçersiz parametreler." }, { status: 400 });
    }

    const { data: bildirim } = await db
      .from("teklif_bildirimleri")
      .select("id, teklif_id, ihale_id, admin_notu")
      .eq("id", bildirimId)
      .single();
    if (!bildirim) {
      return NextResponse.json({ hata: "Bildirim bulunamadı." }, { status: 404 });
    }
    if (!bildirim.admin_notu?.trim()) {
      return NextResponse.json({ hata: "İkaz metni boş olamaz." }, { status: 400 });
    }

    const [{ data: teklif }, { data: ihale }] = await Promise.all([
      db.from("teklifler").select("kullanici_id").eq("id", bildirim.teklif_id).single(),
      db.from("ihaleler").select("baslik").eq("id", bildirim.ihale_id).single(),
    ]);
    if (!teklif?.kullanici_id) {
      return NextResponse.json({ hata: "Teklif bulunamadı." }, { status: 404 });
    }

    const { data: muteahhit } = await db
      .from("kullanicilar")
      .select("email, ad_soyad")
      .eq("id", teklif.kullanici_id)
      .single();

    if (muteahhit?.email) {
      await gonderTeklifIkaziEmaili({
        to: muteahhit.email, adSoyad: muteahhit.ad_soyad,
        ihaleBaslik: ihale?.baslik ?? "İhale", mesaj: bildirim.admin_notu,
      });
    }

    await db.from("bildirimler").insert({
      kullanici_id: teklif.kullanici_id,
      tur: "teklif_ikazi",
      baslik: "Teklifinizle ilgili bir ikaz aldınız",
      mesaj: bildirim.admin_notu,
      link: `/ihaleler/${bildirim.ihale_id}`,
    });

    await db.from("teklif_bildirimleri")
      .update({ ikaz_gonderildi: true, durum: "ikaz_gonderildi" })
      .eq("id", bildirimId);

    return NextResponse.json({ basarili: true });
  } catch (err) {
    console.error("[api/email/teklif-ikazi]", err);
    return NextResponse.json({ hata: "Sunucu hatası." }, { status: 500 });
  }
}
