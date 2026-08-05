import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { odemeOlustur } from "@/lib/iyzico";

// Paket → fiyat ve Supabase güncelleme bilgisi
const PAKET: Record<string, {
  fiyat: string;
  aciklama: string;
  tip: "plan" | "teklif";
  plan?: string;
  teklif_hak?: number;
}> = {
  premium:   { fiyat: "500.00",  aciklama: "Premium Üyelik (1 ay)",    tip: "plan",   plan: "premium"  },
  kurumsal:  { fiyat: "2499.00", aciklama: "Kurumsal Üyelik (1 ay)",   tip: "plan",   plan: "kurumsal" },
  baslangic: { fiyat: "299.00",  aciklama: "Başlangıç Teklif Paketi",  tip: "teklif", teklif_hak: 5    },
  standart:  { fiyat: "699.00",  aciklama: "Standart Teklif Paketi",   tip: "teklif", teklif_hak: 15   },
  pro:       { fiyat: "1499.00", aciklama: "Pro Teklif Paketi (1 ay)", tip: "teklif", teklif_hak: 99999 },
};

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  try {
    // Oturum sunucu tarafinda dogrulanir; kullaniciId/email istemciden
    // GELMEZ — aksi halde biri kendi kartiyla odeme yapip PAKETI BASKA
    // BIR KULLANICIYA (rastgele bir uuid'e) yukleyebilirdi.
    const sessionSupabase = await createSessionClient();
    const { data: { user } } = await sessionSupabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ hata: "Oturum bulunamadı, lütfen giriş yapın." }, { status: 401 });
    }
    const kullaniciId = user.id;
    const email = user.email!;

    const body = await req.json();
    const { paket, kart } = body as {
      paket: string;
      kart: { kartSahibi: string; kartNo: string; sonAy: string; sonYil: string; cvv: string };
    };

    if (!paket || !kart) {
      return NextResponse.json({ hata: "Eksik parametreler." }, { status: 400 });
    }

    const paketBilgi = PAKET[paket];
    if (!paketBilgi) {
      return NextResponse.json({ hata: "Geçersiz paket." }, { status: 400 });
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      req.headers.get("x-real-ip") ??
      "127.0.0.1";

    // ─── Iyzico ödeme ───────────────────────────────────────────────────────
    const sonuc = await odemeOlustur({
      paket,
      fiyat:    paketBilgi.fiyat,
      aciklama: paketBilgi.aciklama,
      kart,
      kullaniciId,
      email,
      ip,
    });

    if (sonuc.status !== "success") {
      return NextResponse.json(
        { hata: sonuc.errorMessage ?? "Ödeme işlemi başarısız oldu.", errorCode: sonuc.errorCode },
        { status: 400 }
      );
    }

    // ─── Ödeme başarılı → Supabase güncelle ─────────────────────────────────
    const db = supabaseAdmin();

    if (paketBilgi.tip === "plan" && paketBilgi.plan) {
      const bitisTarihi = new Date();
      bitisTarihi.setDate(bitisTarihi.getDate() + 30);

      const { error } = await db.from("kullanicilar").update({
        plan_turu:             paketBilgi.plan,
        premium_bitis_tarihi:  bitisTarihi.toISOString(),
      }).eq("id", kullaniciId);

      if (error) console.error("Plan güncelleme hatası:", error);

    } else if (paketBilgi.tip === "teklif" && paketBilgi.teklif_hak !== undefined) {
      if (paketBilgi.teklif_hak >= 99999) {
        // Pro → sınırsız
        await db.from("kullanicilar")
          .update({ kalan_teklif_hakki: 99999 })
          .eq("id", kullaniciId);
      } else {
        // Mevcut hakkı artır — tek atomik RPC (artir_teklif_hakki), oku-hesapla-yaz
        // yerine tek UPDATE ... SET kalan_teklif_hakki = kalan_teklif_hakki + N
        // çalıştırır; eşzamanlı iki ödeme tamamlanması birbirinin yazdığını ezemez.
        const { error: rpcError } = await db.rpc("artir_teklif_hakki", {
          p_kullanici_id: kullaniciId,
          p_miktar: paketBilgi.teklif_hak,
        });
        if (rpcError) console.error("Teklif hakkı artırma hatası:", rpcError);
      }
    }

    return NextResponse.json({ basarili: true, paymentId: sonuc.paymentId });

  } catch (err) {
    console.error("Ödeme sunucu hatası:", err);
    return NextResponse.json({ hata: "Sunucu hatası oluştu, lütfen tekrar deneyin." }, { status: 500 });
  }
}
