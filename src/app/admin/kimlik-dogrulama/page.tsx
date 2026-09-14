"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { KimlikDogrulamaBasvurusu } from "@/lib/types";

const BUCKET = "admin_belgeler_dogrulama";

type Filtre = "bekliyor" | "onaylandi" | "reddedildi";

function tarihSaatFormat(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

function DosyaLinki({ path, etiket }: { path: string | null | undefined; etiket: string }) {
  const [yukleniyor, setYukleniyor] = useState(false);
  if (!path) return null;

  async function ac() {
    setYukleniyor(true);
    const supabase = createClient();
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path as string, 300);
    setYukleniyor(false);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <button type="button" onClick={ac} disabled={yukleniyor}
      className="text-xs font-semibold text-blue-700 hover:underline disabled:opacity-50">
      {yukleniyor ? "…" : etiket}
    </button>
  );
}

function Basvuru({ basvuru, onGuncelle }: { basvuru: KimlikDogrulamaBasvurusu; onGuncelle: (id: string, veri: Partial<KimlikDogrulamaBasvurusu>) => void }) {
  const [redNotu, setRedNotu] = useState("");
  const [islemYapiliyor, setIslemYapiliyor] = useState(false);
  const [redFormuAcik, setRedFormuAcik] = useState(false);

  async function karar(yeniKarar: "onaylandi" | "reddedildi") {
    if (yeniKarar === "reddedildi" && !redNotu.trim()) { setRedFormuAcik(true); return; }
    setIslemYapiliyor(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("kimlik_dogrulama_basvurulari")
      .update({ admin_karari: yeniKarar, red_notu: yeniKarar === "reddedildi" ? redNotu.trim() : null })
      .eq("id", basvuru.id);
    setIslemYapiliyor(false);
    if (!error) onGuncelle(basvuru.id, { admin_karari: yeniKarar, red_notu: redNotu.trim() || null });
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
        <div>
          <p className="font-semibold text-gray-900">
            {basvuru.kisi_turu === "kurumsal" ? basvuru.firma_adi : basvuru.ad_soyad}
            <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
              {basvuru.kisi_turu === "kurumsal" ? "Kurumsal" : "Bireysel"}
            </span>
            {basvuru.otomatik_kontrol_sonucu === "manuel_inceleme" && (
              <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                Manuel İnceleme Gerekli
              </span>
            )}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {basvuru.kisi_turu === "kurumsal" ? `Vergi No: ${basvuru.vergi_no ?? "—"}` : `TC Kimlik: ${basvuru.tc_kimlik_no ?? "—"}`}
            {" · "}{tarihSaatFormat(basvuru.created_at)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <DosyaLinki path={basvuru.kimlik_on_url} etiket="Kimlik Ön Yüz" />
        <DosyaLinki path={basvuru.kimlik_arka_url} etiket="Kimlik Arka Yüz" />
        <DosyaLinki path={basvuru.selfie_url} etiket="Selfie" />
        <DosyaLinki path={basvuru.imza_sirkuleri_url} etiket="İmza Sirküleri" />
        <DosyaLinki path={basvuru.ticaret_sicil_url} etiket="Ticaret Sicil Gazetesi" />
      </div>

      {basvuru.admin_karari === "bekliyor" ? (
        <div className="flex flex-col gap-2">
          <div className="flex gap-3">
            <button
              onClick={() => karar("onaylandi")}
              disabled={islemYapiliyor}
              className="flex-1 bg-green-600 text-white font-semibold py-2 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 text-sm"
            >
              Onayla
            </button>
            <button
              onClick={() => setRedFormuAcik((v) => !v)}
              disabled={islemYapiliyor}
              className="flex-1 border border-red-200 text-red-600 font-semibold py-2 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50 text-sm"
            >
              Reddet
            </button>
          </div>
          {redFormuAcik && (
            <div className="pt-2 border-t border-gray-100">
              <textarea
                rows={2} placeholder="Red sebebi..."
                value={redNotu} onChange={(e) => setRedNotu(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-red-400"
              />
              <button
                onClick={() => karar("reddedildi")}
                disabled={islemYapiliyor || !redNotu.trim()}
                className="bg-red-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 text-sm"
              >
                Reddi Onayla
              </button>
            </div>
          )}
        </div>
      ) : (
        <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
          basvuru.admin_karari === "onaylandi" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
        }`}>
          {basvuru.admin_karari === "onaylandi" ? "Onaylandı ✓" : "Reddedildi ✗"}
        </span>
      )}
    </div>
  );
}

export default function AdminKimlikDogrulama() {
  const [basvurular, setBasvurular] = useState<KimlikDogrulamaBasvurusu[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [yetkisiz, setYetkisiz] = useState(false);
  const [filtre, setFiltre] = useState<Filtre>("bekliyor");

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setYetkisiz(true); setYukleniyor(false); return; }

    const { data: profil } = await supabase.from("kullanicilar").select("rol").eq("id", session.user.id).single();
    if (profil?.rol !== "admin") { setYetkisiz(true); setYukleniyor(false); return; }

    const { data } = await supabase
      .from("kimlik_dogrulama_basvurulari")
      .select("*")
      .eq("admin_karari", filtre)
      .order("created_at", { ascending: true });
    setBasvurular((data ?? []) as KimlikDogrulamaBasvurusu[]);
    setYukleniyor(false);
  }, [filtre]);

  useEffect(() => { yukle(); }, [yukle]);

  function guncelle(id: string, veri: Partial<KimlikDogrulamaBasvurusu>) {
    setBasvurular((liste) => liste.map((b) => (b.id === id ? { ...b, ...veri } : b)).filter((b) => b.admin_karari === filtre));
  }

  if (yetkisiz) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center">
        <p className="text-gray-600">Bu sayfayı görüntülemek için admin yetkisi gereklidir.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Kimlik Doğrulama Başvuruları</h1>
        <p className="text-gray-500 text-sm mt-1">Bireysel/kurumsal kimlik doğrulama başvurularını inceleyip onaylayın ya da reddedin.</p>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
        {([["bekliyor", "Bekleyenler"], ["onaylandi", "Onaylı"], ["reddedildi", "Reddedildi"]] as [Filtre, string][]).map(([k, e]) => (
          <button key={k} onClick={() => setFiltre(k)}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              filtre === k ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}>
            {e}
          </button>
        ))}
      </div>

      {yukleniyor ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-white rounded-2xl border border-gray-200 animate-pulse" />)}
        </div>
      ) : basvurular.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg font-medium">Bu filtrede başvuru yok</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {basvurular.map((b) => <Basvuru key={b.id} basvuru={b} onGuncelle={guncelle} />)}
        </div>
      )}
    </div>
  );
}
