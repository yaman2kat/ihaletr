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
  premium:           { fiyat: "499.00",  aciklama: "Premium Üyelik (1 ay)",     tip: "plan",   plan: "premium"  },
  kurumsal:          { fiyat: "2499.00", aciklama: "Kurumsal Üyelik (1 ay)",    tip: "plan",   plan: "kurumsal" },
  "teklif-temel":    { fiyat: "699.00",  aciklama: "Temel Paket (1 teklif hakkı)",        tip: "teklif", teklif_hak: 1     },
  "teklif-kurumsal": { fiyat: "2299.00", aciklama: "Kurumsal Paket (sınırsız, 1 ay)",     tip: "teklif", teklif_hak: 99999 },
};

// Kart deneme (card testing) saldirisina karsi: bir kullanicinin belirli
// bir surede yapabilecegi odeme denemesi sayisi sinirlanir.
const RATE_LIMIT_PENCERE_DK = 10;
const RATE_LIMIT_MAKS_DENEME = 5;

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

async function krediUygula(
  db: ReturnType<typeof supabaseAdmin>,
  kullaniciId: string,
  paketBilgi: (typeof PAKET)[string]
): Promise<{ basarili: boolean; hata?: string }> {
  if (paketBilgi.tip === "plan" && paketBilgi.plan) {
    const bitisTarihi = new Date();
    bitisTarihi.setDate(bitisTarihi.getDate() + 30);
    const { error } = await db.from("kullanicilar").update({
      plan_turu:            paketBilgi.plan,
      premium_bitis_tarihi: bitisTarihi.toISOString(),
    }).eq("id", kullaniciId);
    return { basarili: !error, hata: error?.message };
  }

  if (paketBilgi.tip === "teklif" && paketBilgi.teklif_hak !== undefined) {
    if (paketBilgi.teklif_hak >= 99999) {
      const { error } = await db.from("kullanicilar")
        .update({ kalan_teklif_hakki: 99999 })
        .eq("id", kullaniciId);
      return { basarili: !error, hata: error?.message };
    }
    // Tek atomik RPC (artir_teklif_hakki) — oku-hesapla-yaz yerine tek
    // UPDATE ... SET kalan_teklif_hakki = kalan_teklif_hakki + N calisir;
    // eszamanli iki odeme tamamlanmasi birbirinin yazdigini ezemez.
    const { error } = await db.rpc("artir_teklif_hakki", {
      p_kullanici_id: kullaniciId,
      p_miktar: paketBilgi.teklif_hak,
    });
    return { basarili: !error, hata: error?.message };
  }

  return { basarili: true };
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
    const db = supabaseAdmin();

    // ─── Rate limit: kart deneme (card testing) korumasi ────────────────────
    const pencereBaslangici = new Date(Date.now() - RATE_LIMIT_PENCERE_DK * 60_000).toISOString();
    const { count: sonDenemeSayisi } = await db
      .from("odeme_kayitlari")
      .select("*", { count: "exact", head: true })
      .eq("kullanici_id", kullaniciId)
      .gte("created_at", pencereBaslangici);

    if ((sonDenemeSayisi ?? 0) >= RATE_LIMIT_MAKS_DENEME) {
      return NextResponse.json(
        { hata: `Çok fazla ödeme denemesi yaptınız. Lütfen ${RATE_LIMIT_PENCERE_DK} dakika sonra tekrar deneyin.` },
        { status: 429 }
      );
    }

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

    // ─── Performans indirimi: müteahhit teklif paketlerinde, sınırsız
    // paket sahibi + en az 10 yorum + 4.5 üzeri ortalama puan şartlarını
    // sağlayan kullanıcılara %50 indirim uygulanır. İstemciden GELMEZ —
    // fiyat kaçırma (client'ta indirim uygulanmış gösterip gerçekte
    // uygulanmamış fiyat gönderme) riskine karşı burada, servis rolüyle,
    // sunucu tarafında yeniden hesaplanır.
    let fiyat = paketBilgi.fiyat;
    if (paketBilgi.tip === "teklif") {
      const { data: indirimVarMi } = await db.rpc("performans_indirimi_uygulanir_mi", {
        p_kullanici_id: kullaniciId,
      });
      if (indirimVarMi) {
        fiyat = (parseFloat(paketBilgi.fiyat) / 2).toFixed(2);
      }
    }

    // ─── Iyzico ödeme ───────────────────────────────────────────────────────
    const sonuc = await odemeOlustur({
      paket,
      fiyat,
      aciklama: paketBilgi.aciklama,
      kart,
      kullaniciId,
      email,
      ip,
    });

    if (sonuc.status !== "success") {
      await db.from("odeme_kayitlari").insert({
        kullanici_id: kullaniciId,
        paket,
        durum: "basarisiz",
        hata_mesaji: sonuc.errorMessage ?? sonuc.errorCode ?? "bilinmeyen hata",
      });
      return NextResponse.json(
        { hata: sonuc.errorMessage ?? "Ödeme işlemi başarısız oldu.", errorCode: sonuc.errorCode },
        { status: 400 }
      );
    }

    // ─── Ödeme başarılı → Supabase güncelle (basarisizsa 1 kez tekrar dene) ──
    let kredi = await krediUygula(db, kullaniciId, paketBilgi);
    if (!kredi.basarili) {
      console.error("Kredi uygulama hatasi, tekrar deneniyor:", kredi.hata);
      kredi = await krediUygula(db, kullaniciId, paketBilgi);
    }

    // Odeme her durumda (basarili ya da hesaba yansitilamadi) kayit altina
    // alinir — kullanicinin karti tahsil edildigi icin bu asamadan sonra
    // "basarisiz" degil, en kotu ihtimalle "odendi ama yansitilamadi" olur.
    await db.from("odeme_kayitlari").insert({
      kullanici_id: kullaniciId,
      paket,
      iyzico_payment_id: sonuc.paymentId,
      durum: kredi.basarili ? "basarili" : "db_guncelleme_hatasi",
      hata_mesaji: kredi.basarili ? null : kredi.hata,
    });

    if (!kredi.basarili) {
      console.error(`ODEME MUTABAKAT HATASI: kullanici=${kullaniciId} paket=${paket} paymentId=${sonuc.paymentId} hata=${kredi.hata}`);
    }

    return NextResponse.json({ basarili: true, paymentId: sonuc.paymentId, uyari: !kredi.basarili });

  } catch (err) {
    console.error("Ödeme sunucu hatası:", err);
    return NextResponse.json({ hata: "Sunucu hatası oluştu, lütfen tekrar deneyin." }, { status: 500 });
  }
}
