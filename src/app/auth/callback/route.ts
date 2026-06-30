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
