"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { TeklifBildirimi, TeklifBildirimDurumu } from "@/lib/types";
import { SEBEP_ETIKETLERI, IKAZ_METIN_SABLONLARI } from "@/lib/teklif-ikaz";
import { hataMesaji } from "@/lib/hata-mesaji";

const TEKLIF_DOSYALARI_BUCKET = "ihale-teklif-dosyalari";

const DURUM_BADGE: Record<TeklifBildirimDurumu, { etiket: string; cls: string }> = {
  beklemede:        { etiket: "Bekliyor",        cls: "bg-amber-100 text-amber-700" },
  incelendi:        { etiket: "İncelendi",       cls: "bg-gray-100 text-gray-600" },
  ikaz_gonderildi:  { etiket: "İkaz Gönderildi", cls: "bg-red-100 text-red-600" },
};

type Filtre = "beklemede" | "incelendi" | "ikaz_gonderildi" | "tumu";

interface SatirVerisi extends TeklifBildirimi {
  ihaleBaslik: string;
  ihaleKisaKod: string;
  muteahhitAdi: string;
  bildirenAdi: string;
  teklifDosyasiYolu: string | null;
  alternatifProjeYolu: string | null;
  teklifTutar: number | null;
}

function kisaKod(id: string): string {
  return "#" + id.slice(0, 8).toUpperCase();
}

function tarihSaatFormat(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

function DosyaLinki({ path, etiket }: { path: string; etiket: string }) {
  const [yukleniyor, setYukleniyor] = useState(false);

  async function ac() {
    setYukleniyor(true);
    const supabase = createClient();
    const { data } = await supabase.storage.from(TEKLIF_DOSYALARI_BUCKET).createSignedUrl(path, 300);
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

function SatirDetay({ satir, onGuncelle }: { satir: SatirVerisi; onGuncelle: (id: string, veri: Partial<SatirVerisi>) => void }) {
  const [notMetni, setNotMetni] = useState(satir.admin_notu ?? IKAZ_METIN_SABLONLARI[satir.sebep](satir.ihaleBaslik));
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [hata, setHata] = useState("");

  async function ikazGonder() {
    setGonderiliyor(true);
    setHata("");
    const supabase = createClient();

    const { error: guncelleHata } = await supabase
      .from("teklif_bildirimleri")
      .update({ admin_notu: notMetni })
      .eq("id", satir.id);
    if (guncelleHata) { setGonderiliyor(false); setHata(hataMesaji(guncelleHata)); return; }

    try {
      const res = await fetch("/api/email/teklif-ikazi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bildirimId: satir.id }),
      });
      const veri = await res.json();
      if (!res.ok || veri.hata) { setHata(veri.hata ? hataMesaji(veri.hata) : "İkaz gönderilemedi."); setGonderiliyor(false); return; }
    } catch {
      setHata("Bağlantı hatası, lütfen tekrar deneyin.");
      setGonderiliyor(false);
      return;
    }

    setGonderiliyor(false);
    onGuncelle(satir.id, { admin_notu: notMetni, ikaz_gonderildi: true, durum: "ikaz_gonderildi" });
  }

  return (
    <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
      {hata && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-2.5 mb-3">{hata}</div>}
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">İkaz Metni</label>
      <textarea
        rows={4}
        value={notMetni}
        onChange={(e) => setNotMetni(e.target.value)}
        disabled={satir.ikaz_gonderildi}
        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-400 disabled:bg-gray-100 disabled:text-gray-400 mb-3"
      />
      {satir.ikaz_gonderildi ? (
        <p className="text-xs font-semibold text-green-700">İkaz gönderildi ✓</p>
      ) : (
        <button
          type="button"
          onClick={ikazGonder}
          disabled={gonderiliyor || !notMetni.trim()}
          className="bg-red-600 text-white font-semibold px-5 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 text-sm"
        >
          {gonderiliyor ? "Gönderiliyor…" : "İkaz Gönder"}
        </button>
      )}
    </div>
  );
}

export default function AdminSorgulananTeklifler() {
  const [satirlar,   setSatirlar]   = useState<SatirVerisi[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [yetkisiz,   setYetkisiz]   = useState(false);
  const [adminDogrulandi, setAdminDogrulandi] = useState(false);
  const [filtre,     setFiltre]     = useState<Filtre>("beklemede");
  const [acikSatir,  setAcikSatir]  = useState<string | null>(null);

  useEffect(() => {
    async function dogrula() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setYetkisiz(true); setYukleniyor(false); return; }
      const { data: profil } = await supabase.from("kullanicilar").select("rol").eq("id", session.user.id).single();
      if (profil?.rol !== "admin") { setYetkisiz(true); setYukleniyor(false); return; }
      setAdminDogrulandi(true);
    }
    dogrula();
  }, []);

  const yukle = useCallback(async () => {
    if (!adminDogrulandi) return;
    setYukleniyor(true);
    const supabase = createClient();

    let sorgu = supabase.from("teklif_bildirimleri").select("*").order("olusturulma_tarihi", { ascending: false });
    if (filtre !== "tumu") sorgu = sorgu.eq("durum", filtre);
    const { data: bildirimler } = await sorgu;
    const liste = (bildirimler ?? []) as TeklifBildirimi[];

    if (liste.length === 0) { setSatirlar([]); setYukleniyor(false); return; }

    const teklifIdler = [...new Set(liste.map((b) => b.teklif_id))];
    const ihaleIdler  = [...new Set(liste.map((b) => b.ihale_id))];

    const [{ data: teklifler }, { data: ihaleler }] = await Promise.all([
      supabase.from("teklifler").select("id, kullanici_id, tutar, teklif_dosyasi_url, alternatif_proje_url").in("id", teklifIdler),
      supabase.from("ihaleler").select("id, baslik").in("id", ihaleIdler),
    ]);

    const teklifHarita = new Map((teklifler ?? []).map((t) => [t.id, t]));
    const ihaleHarita  = new Map((ihaleler ?? []).map((i) => [i.id, i]));

    const kullaniciIdler = [...new Set([
      ...(teklifler ?? []).map((t) => t.kullanici_id),
      ...liste.map((b) => b.bildiren_id),
    ])];
    const { data: kullanicilar } = kullaniciIdler.length > 0
      ? await supabase.from("kullanicilar_ozet").select("id, ad_soyad, firma_adi").in("id", kullaniciIdler)
      : { data: [] as { id: string; ad_soyad: string; firma_adi: string | null }[] };
    const kullaniciHarita = new Map((kullanicilar ?? []).map((k) => [k.id, k]));

    const satirVerisi: SatirVerisi[] = liste.map((b) => {
      const teklif = teklifHarita.get(b.teklif_id);
      const ihale = ihaleHarita.get(b.ihale_id);
      const muteahhit = teklif ? kullaniciHarita.get(teklif.kullanici_id) : undefined;
      const bildiren = kullaniciHarita.get(b.bildiren_id);
      return {
        ...b,
        ihaleBaslik: ihale?.baslik ?? "İhale",
        ihaleKisaKod: kisaKod(b.ihale_id),
        muteahhitAdi: muteahhit?.firma_adi || muteahhit?.ad_soyad || "Bilinmiyor",
        bildirenAdi: bildiren?.firma_adi || bildiren?.ad_soyad || "Bilinmiyor",
        teklifDosyasiYolu: teklif?.teklif_dosyasi_url ?? null,
        alternatifProjeYolu: teklif?.alternatif_proje_url ?? null,
        teklifTutar: teklif?.tutar ?? null,
      };
    });

    setSatirlar(satirVerisi);
    setYukleniyor(false);
  }, [adminDogrulandi, filtre]);

  useEffect(() => { yukle(); }, [yukle]);

  function satirGuncelle(id: string, veri: Partial<SatirVerisi>) {
    setSatirlar((p) => p.map((s) => (s.id === id ? { ...s, ...veri } : s)));
  }

  if (yetkisiz) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center">
        <p className="text-gray-600">Bu sayfayı görüntülemek için admin yetkisi gereklidir.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Sorgulanan Teklifler</h1>
        <p className="text-gray-500 text-sm mt-1">
          İhale sahiplerinin şüpheli/sahte olarak bildirdiği teklifleri inceleyin ve gerekirse müteahhide ikaz gönderin.
        </p>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
        {([
          ["beklemede", "Bekleyen"],
          ["incelendi", "İncelendi"],
          ["ikaz_gonderildi", "İkaz Gönderildi"],
          ["tumu", "Tümü"],
        ] as [Filtre, string][]).map(([k, e]) => (
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
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-white rounded-xl border border-gray-200 animate-pulse" />)}
        </div>
      ) : satirlar.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg font-medium">Bu filtrede bildirim yok</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {satirlar.map((s) => (
            <div key={s.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Link href={`/admin/ihaleler/${s.ihale_id}`} className="font-semibold text-gray-900 hover:text-blue-700 transition-colors">
                        {s.ihaleKisaKod} - {s.ihaleBaslik}
                      </Link>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${DURUM_BADGE[s.durum].cls}`}>
                        {DURUM_BADGE[s.durum].etiket}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Müteahhit: <strong>{s.muteahhitAdi}</strong> · Bildiren: {s.bildirenAdi} · {tarihSaatFormat(s.olusturulma_tarihi)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAcikSatir((v) => (v === s.id ? null : s.id))}
                    className="text-xs font-semibold text-blue-600 hover:underline flex-shrink-0"
                  >
                    {acikSatir === s.id ? "Kapat" : "İkaz / Detay"}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-3 mt-2">
                  <span className="text-xs font-medium bg-orange-50 text-orange-700 px-2.5 py-1 rounded-full">
                    {SEBEP_ETIKETLERI[s.sebep]}
                  </span>
                  {s.aciklama && <span className="text-xs text-gray-500 italic">&quot;{s.aciklama}&quot;</span>}
                  {s.teklifDosyasiYolu && <DosyaLinki path={s.teklifDosyasiYolu} etiket="Teklif Dosyası →" />}
                  {s.alternatifProjeYolu && <DosyaLinki path={s.alternatifProjeYolu} etiket="Alternatif Proje →" />}
                </div>
              </div>

              {acikSatir === s.id && <SatirDetay satir={s} onGuncelle={satirGuncelle} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
