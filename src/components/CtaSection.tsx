"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function CtaSection() {
  const [gosterilsin, setGosterilsin] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setGosterilsin(!session?.user);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setGosterilsin(!session?.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Session kontrol edilene kadar yer tutucu gösterme (layout shift önleme)
  if (gosterilsin === undefined || !gosterilsin) return null;

  return (
    <section className="bg-blue-700 text-white py-16 px-4">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-3xl font-bold mb-4">Hemen Başlayın</h2>
        <p className="text-blue-100 mb-8 text-lg">
          Ücretsiz kayıt olun, ihalelere teklif verin ve işlerinizi büyütün.
        </p>
        <Link
          href="/kayit"
          className="bg-white text-blue-700 font-semibold px-10 py-3.5 rounded-xl hover:bg-blue-50 transition-colors text-lg inline-block"
        >
          Ücretsiz Hesap Oluştur
        </Link>
      </div>
    </section>
  );
}
