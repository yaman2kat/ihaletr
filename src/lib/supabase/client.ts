import { createBrowserClient } from "@supabase/ssr";

// beniHatirla=false: oturum sessionStorage'da tutulur, tarayıcı sekmesi
// kapanınca silinir. Varsayılan (true) mevcut davranış — localStorage,
// tarayıcı yeniden açılsa da oturum devam eder.
export function createClient(beniHatirla: boolean = true) {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    beniHatirla ? undefined : { auth: { storage: window.sessionStorage } }
  );
}
