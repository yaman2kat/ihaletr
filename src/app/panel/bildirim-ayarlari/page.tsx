"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { BildirimTercihleri, Kullanici } from "@/lib/types";

const SECENEKLER: { alan: keyof Omit<BildirimTercihleri, "kullanici_id" | "updated_at">; baslik: string; aciklama: string }[] = [
  { alan: "yeni_teklif", baslik: "Yeni teklif alındı", aciklama: "İhalenize yeni bir teklif verildiğinde bildirim al." },
  { alan: "ihale_durumu", baslik: "İhale durumu (onay/red/otomatik sonlandırma)", aciklama: "İhaleniz admin tarafından onaylandığında, reddedildiğinde ya da süresi dolup otomatik sonlandırıldığında bildirim al." },
  { alan: "davet_odulu", baslik: "Davet ödülü", aciklama: "Davet ettiğiniz biri kayıt olup ödül kazandırdığında bildirim al." },
  { alan: "odeme_sorunu", baslik: "Ödeme sorunu", aciklama: "Ödemeniz alınıp hesabınıza yansıtılamadığında bildirim al." },
  { alan: "bolge_eslesmesi", baslik: "Bölgenizde yeni ihale", aciklama: "Çalıştığınız illerden birinde yeni bir ihale onaylanıp yayınlandığında bildirim al (müteahhitler için)." },
];

type EmailAlan = "email_yeni_teklif" | "email_ihale_durumu" | "email_davet_odulu" | "email_odeme_sorunu" | "email_bolge_eslesmesi" | "email_sure_uyarisi";

const EMAIL_SECENEKLER: { alan: EmailAlan; baslik: string; aciklama: string }[] = [
  { alan: "email_yeni_teklif", baslik: "Yeni teklif alındı", aciklama: "İhalenize yeni bir teklif verildiğinde e-posta al." },
  { alan: "email_ihale_durumu", baslik: "İhale durumu (onay/red/otomatik sonlandırma)", aciklama: "İhaleniz onaylandığında, reddedildiğinde ya da otomatik sonlandırıldığında e-posta al." },
  { alan: "email_davet_odulu", baslik: "Davet ödülü", aciklama: "Davet ettiğiniz biri kayıt olup ödül kazandırdığında e-posta al." },
  { alan: "email_odeme_sorunu", baslik: "Ödeme sorunu", aciklama: "Ödemeniz alınıp hesabınıza yansıtılamadığında e-posta al." },
  { alan: "email_bolge_eslesmesi", baslik: "Bölgenizde yeni ihale", aciklama: "Çalıştığınız illerden birinde yeni bir ihale yayınlandığında e-posta al (müteahhitler için)." },
  { alan: "email_sure_uyarisi", baslik: "Süre dolmadan uyarı", aciklama: "İhalenizin son teklif tarihine 48 saatten az kaldığında e-posta al." },
];

export default function BildirimAyarlari() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [tercihler, setTercihler] = useState<BildirimTercihleri | null>(null);
  const [emailTercihler, setEmailTercihler] = useState<Pick<Kullanici, EmailAlan> | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [kaydediliyor, setKaydediliyor] = useState<string | null>(null);
  const [hata, setHata] = useState("");

  useEffect(() => {
    const supabase = createClient();
    async function yukle() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.replace("/giris?next=" + encodeURIComponent("/panel/bildirim-ayarlari")); return; }
      setUserId(session.user.id);

      const [{ data }, { data: kullanici }] = await Promise.all([
        supabase.from("bildirim_tercihleri").select("*").eq("kullanici_id", session.user.id).maybeSingle(),
        supabase
          .from("kullanicilar")
          .select("email_yeni_teklif, email_ihale_durumu, email_davet_odulu, email_odeme_sorunu, email_bolge_eslesmesi, email_sure_uyarisi")
          .eq("id", session.user.id)
          .single(),
      ]);
      if (data) {
        setTercihler(data as BildirimTercihleri);
      } else {
        // Satir henuz yoksa (ör. eski hesap, backfill'den once) varsayilan
        // (hepsi acik) satiri olustur.
        const { data: yeni } = await supabase
          .from("bildirim_tercihleri")
          .insert({ kullanici_id: session.user.id })
          .select()
          .single();
        setTercihler(yeni as BildirimTercihleri);
      }
      if (kullanici) setEmailTercihler(kullanici as Pick<Kullanici, EmailAlan>);
      setYukleniyor(false);
    }
    yukle();
  }, [router]);

  async function degistir(alan: keyof Omit<BildirimTercihleri, "kullanici_id" | "updated_at">) {
    if (!tercihler || !userId) return;
    const yeniDeger = !tercihler[alan];
    setTercihler({ ...tercihler, [alan]: yeniDeger });
    setKaydediliyor(alan);
    setHata("");

    const supabase = createClient();
    const { error } = await supabase.from("bildirim_tercihleri").update({ [alan]: yeniDeger }).eq("kullanici_id", userId);
    setKaydediliyor(null);
    if (error) {
      setTercihler((t) => (t ? { ...t, [alan]: !yeniDeger } : t));
      setHata("Kaydedilemedi: " + error.message);
    }
  }

  async function emailDegistir(alan: EmailAlan) {
    if (!emailTercihler || !userId) return;
    const yeniDeger = !emailTercihler[alan];
    setEmailTercihler({ ...emailTercihler, [alan]: yeniDeger });
    setKaydediliyor(alan);
    setHata("");

    const supabase = createClient();
    const { error } = await supabase.from("kullanicilar").update({ [alan]: yeniDeger }).eq("id", userId);
    setKaydediliyor(null);
    if (error) {
      setEmailTercihler((t) => (t ? { ...t, [alan]: !yeniDeger } : t));
      setHata("Kaydedilemedi: " + error.message);
    }
  }

  if (yukleniyor || !tercihler || !emailTercihler) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="h-8 bg-gray-100 rounded w-48 mb-6 animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((n) => <div key={n} className="h-20 bg-white border border-gray-200 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/panel" className="hover:text-blue-700">Panelim</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Bildirim Ayarları</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">Bildirim Ayarları</h1>
      <p className="text-gray-500 text-sm mb-8">Hangi olaylarda uygulama içi bildirim almak istediğinizi seçin.</p>

      {hata && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-6">{hata}</div>
      )}

      <div className="flex flex-col gap-3">
        {SECENEKLER.map((s) => {
          const aktif = tercihler[s.alan];
          return (
            <div key={s.alan} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">{s.baslik}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.aciklama}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={aktif}
                aria-label={s.baslik}
                disabled={kaydediliyor === s.alan}
                onClick={() => degistir(s.alan)}
                className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${aktif ? "bg-blue-700" : "bg-gray-200"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${aktif ? "translate-x-5" : ""}`} />
              </button>
            </div>
          );
        })}
      </div>

      <h2 className="text-lg font-bold text-gray-900 mt-10 mb-1">E-posta Bildirimleri</h2>
      <p className="text-gray-500 text-sm mb-6">Hangi olaylarda e-posta almak istediğinizi seçin.</p>

      <div className="flex flex-col gap-3">
        {EMAIL_SECENEKLER.map((s) => {
          const aktif = emailTercihler[s.alan];
          return (
            <div key={s.alan} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">{s.baslik}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.aciklama}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={aktif}
                aria-label={s.baslik}
                disabled={kaydediliyor === s.alan}
                onClick={() => emailDegistir(s.alan)}
                className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${aktif ? "bg-blue-700" : "bg-gray-200"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${aktif ? "translate-x-5" : ""}`} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
