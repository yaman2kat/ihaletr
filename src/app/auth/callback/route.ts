import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const code       = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type       = searchParams.get("type") as EmailOtpType | null;
  const next       = searchParams.get("next") ?? "/";

  console.log("[auth/callback] URL:", request.url);
  console.log("[auth/callback] code:", !!code, "| token_hash:", !!token_hash, "| type:", type, "| next:", next);

  const supabase = await createClient();

  // ── PKCE flow: Supabase ?code= parametresiyle yönlendirdi ──
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    console.log("[auth/callback] exchangeCodeForSession →", error ? `HATA: ${error.message}` : "OK");
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Google/Apple ile girişte public.kullanicilar'da profil satırı
        // yoksa, handle_new_user tetikleyicisi bu e-postayı zaten başka
        // bir hesaba kayıtlı bulup INSERT'i sessizce atlamıştır (bkz.
        // supabase/google_oauth_fix.sql). Kullanıcıyı profilsiz bir
        // oturumda bırakmak yerine oturumu kapatıp net bir mesajla
        // giriş sayfasına yönlendiriyoruz.
        const { data: profil } = await supabase
          .from("kullanicilar")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();

        if (!profil) {
          let hesapZatenVar = false;
          if (user.email) {
            // kullanicilar tablosu artik sadece kendi satirini gostermeye
            // izin veriyor (RLS); baska bir email'in kayitli olup olmadigi
            // sadece bu dar-kapsamli RPC ile (veri sizdirmadan) sorulabilir.
            const { data } = await supabase.rpc("email_kayitli_mi", { p_email: user.email });
            hesapZatenVar = !!data;
          }

          await supabase.auth.signOut();

          const mesaj = hesapZatenVar
            ? "Bu e-posta adresi zaten kayıtlı, lütfen giriş yapın."
            : "Hesap oluşturulamadı. Lütfen tekrar deneyin.";
          const nextEk = next !== "/" ? `&next=${encodeURIComponent(next)}` : "";
          return NextResponse.redirect(`${origin}/giris?hata=${encodeURIComponent(mesaj)}${nextEk}`);
        }

        // Google/Apple ile kayıt (signInWithOAuth) signUp() gibi custom
        // metadata taşıyamaz; hesap_turu ve davet kodu buradan tamamlanır.
        const hesapTuru = searchParams.get("hesap_turu");
        const refKodu   = searchParams.get("ref");
        if (hesapTuru || refKodu) {
          await supabase.rpc("oauth_kayit_tamamla", {
            p_hesap_turu: hesapTuru,
            p_ref_kodu: refKodu,
          });
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(
      `${origin}/giris?hata=${encodeURIComponent("Doğrulama başarısız: " + error.message)}`
    );
  }

  // ── OTP / token_hash flow: bazı Supabase yapılandırmalarında ──
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    console.log("[auth/callback] verifyOtp →", error ? `HATA: ${error.message}` : "OK");
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(
      `${origin}/giris?hata=${encodeURIComponent("Token doğrulama başarısız: " + error.message)}`
    );
  }

  console.log("[auth/callback] ne code ne token_hash geldi — tam URL:", request.url);
  return NextResponse.redirect(`${origin}/giris?hata=dogrulama-basarisiz`);
}
