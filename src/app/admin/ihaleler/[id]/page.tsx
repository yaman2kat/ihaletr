"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Ihale, Belge, IncelemeDurumu } from "@/lib/types";

const HIZLI_RED_SEBEPLERI = [
  "Dosya boyutu sınırı aşıldı",
  "Tapu belgesi okunaksız/eksik",
  "Mülkiyet bilgisi tapu ile uyuşmuyor",
  "Taşınmaz bilgileri hatalı/eksik",
];

const MULKIYET_ETIKET: Record<string, string> = {
  tek_malik: "Tek Malikim",
  hisseli:   "Hisseli Mülkiyet",
  vekaleten: "Vekaleten İşlem Yapıyor",
  sirket:    "Şirket Adına",
};

const INCELEME_BADGE: Record<IncelemeDurumu, { etiket: string; cls: string }> = {
  beklemede:  { etiket: "İnceleniyor", cls: "bg-gray-100 text-gray-600" },
  onaylandi:  { etiket: "Onaylı",      cls: "bg-green-100 text-green-700" },
  reddedildi: { etiket: "Reddedildi",  cls: "bg-red-100 text-red-600" },
};

const OZEL_BUCKET = "ihale-tapu-belgeleri";

function formatBoyut(bytes?: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function BelgeSatiri({ belge, imzaliUrl }: { belge: Belge; imzaliUrl?: string }) {
  const href = imzaliUrl ?? belge.dosya_url;
  return (
    <a
      href={href} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-3 hover:border-blue-300 hover:bg-blue-50/40 transition-colors"
    >
      <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{belge.baslik}</p>
        <p className="text-xs text-gray-400">{formatBoyut(belge.boyut)}</p>
      </div>
      <span className="text-xs text-blue-600 font-medium flex-shrink-0">Görüntüle →</span>
    </a>
  );
}

export default function AdminIhaleIncele() {
  const { id } = useParams<{ id: string }>();

  const [ihale,      setIhale]      = useState<Ihale | null>(null);
  const [belgeler,   setBelgeler]   = useState<Belge[]>([]);
  const [imzaliUrller, setImzaliUrller] = useState<Record<string, string>>({});
  const [yukleniyor, setYukleniyor] = useState(true);
  const [yetkisiz,   setYetkisiz]   = useState(false);
  const [bulunamadi, setBulunamadi] = useState(false);
  const [redFormuAcik, setRedFormuAcik] = useState(false);
  const [redSebebi,  setRedSebebi]  = useState("");
  const [islemYapiliyor, setIslemYapiliyor] = useState(false);
  const redSebebiRef = useRef<HTMLTextAreaElement>(null);

  function hizliSebepEkle(sebep: string) {
    const temiz = redSebebi.trim();
    const yeni = !temiz ? sebep : temiz.includes(sebep) ? temiz : `${temiz}; ${sebep}`;
    setRedSebebi(yeni);
    // Odaklanma ve imlec konumu React'in yeniden render etmesini beklemeden
    // (requestAnimationFrame ile) degil, ayni tikte DOM'a dogrudan yazilir —
    // aksi halde hemen ardindan yazmaya baslayan bir kullanicinin ilk birkac
    // tus vurusu kaybolabiliyordu (test sirasinda tespit edildi).
    const el = redSebebiRef.current;
    if (el) {
      el.value = yeni;
      el.focus();
      el.selectionStart = el.selectionEnd = yeni.length;
    }
  }
  const [hata, setHata] = useState("");

  const yukle = useCallback(async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setYetkisiz(true); setYukleniyor(false); return; }

    const { data: profil } = await supabase
      .from("kullanicilar")
      .select("rol")
      .eq("id", session.user.id)
      .single();
    if (profil?.rol !== "admin") { setYetkisiz(true); setYukleniyor(false); return; }

    const [{ data: ihaleData }, { data: belgeData }] = await Promise.all([
      supabase.from("ihaleler").select("*").eq("id", id).single(),
      supabase.from("belgeler").select("*").eq("ihale_id", id).order("created_at", { ascending: true }),
    ]);

    if (!ihaleData) { setBulunamadi(true); setYukleniyor(false); return; }
    setIhale(ihaleData as Ihale);
    const belgeListesi = (belgeData ?? []) as Belge[];
    setBelgeler(belgeListesi);

    // Özel (private) bucket'taki belgeler için imzalı, süreli erişim linki üret.
    const ozelBelgeler = belgeListesi.filter((b) => ["tapu", "vekaletname", "imza_sirkuleri"].includes(b.tur));
    const urlGirdileri = await Promise.all(
      ozelBelgeler.map(async (b) => {
        const { data } = await supabase.storage.from(OZEL_BUCKET).createSignedUrl(b.dosya_url, 300);
        return [b.id, data?.signedUrl ?? ""] as const;
      })
    );
    setImzaliUrller(Object.fromEntries(urlGirdileri.filter(([, url]) => url)));

    setYukleniyor(false);
  }, [id]);

  useEffect(() => { yukle(); }, [yukle]);

  async function onayla() {
    if (!ihale) return;
    setIslemYapiliyor(true);
    setHata("");
    const supabase = createClient();
    const { error } = await supabase
      .from("ihaleler")
      .update({ inceleme_durumu: "onaylandi", red_sebebi: null })
      .eq("id", ihale.id);
    setIslemYapiliyor(false);
    if (error) { setHata("Onaylanamadı: " + error.message); return; }
    setIhale((i) => (i ? { ...i, inceleme_durumu: "onaylandi", red_sebebi: null } : i));
    setRedFormuAcik(false);
  }

  async function reddet(e: React.FormEvent) {
    e.preventDefault();
    if (!ihale) return;
    if (!redSebebi.trim()) { setHata("Red sebebi zorunludur."); return; }
    setIslemYapiliyor(true);
    setHata("");
    const supabase = createClient();
    const { error } = await supabase
      .from("ihaleler")
      .update({ inceleme_durumu: "reddedildi", red_sebebi: redSebebi.trim() })
      .eq("id", ihale.id);
    setIslemYapiliyor(false);
    if (error) { setHata("Reddedilemedi: " + error.message); return; }
    setIhale((i) => (i ? { ...i, inceleme_durumu: "reddedildi", red_sebebi: redSebebi.trim() } : i));
    setRedFormuAcik(false);
  }

  if (yetkisiz) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center">
        <p className="text-gray-600">Bu sayfayı görüntülemek için admin yetkisi gereklidir.</p>
      </div>
    );
  }

  if (bulunamadi) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center">
        <p className="text-gray-600">İhale bulunamadı.</p>
        <Link href="/admin/ihaleler" className="text-blue-600 hover:underline text-sm">← İhale listesine dön</Link>
      </div>
    );
  }

  if (yukleniyor || !ihale) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="h-40 bg-white border border-gray-200 rounded-2xl animate-pulse" />
      </div>
    );
  }

  const durum = ihale.inceleme_durumu ?? "beklemede";
  const tapuBelgesi        = belgeler.find((b) => b.tur === "tapu");
  const vekaletnameBelgesi = belgeler.find((b) => b.tur === "vekaletname");
  const imzaBelgesi        = belgeler.find((b) => b.tur === "imza_sirkuleri");
  const digerBelgeler      = belgeler.filter((b) => !["tapu", "vekaletname", "imza_sirkuleri"].includes(b.tur));

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <Link href="/admin/ihaleler" className="text-sm text-gray-400 hover:text-gray-700 mb-4 inline-block">
        ← İhale listesine dön
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{ihale.baslik}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{ihale.kurum} · {ihale.sehir}{ihale.ilce ? ` / ${ihale.ilce}` : ""}</p>
        </div>
        <span className={`text-xs font-bold px-3 py-1 rounded-full flex-shrink-0 ${INCELEME_BADGE[durum].cls}`}>
          {INCELEME_BADGE[durum].etiket}
        </span>
      </div>

      {hata && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-6">{hata}</div>
      )}

      {/* Mülkiyet Bilgisi */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
        <h2 className="text-sm font-bold text-gray-900 mb-4">Mülkiyet Bilgisi</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Mülkiyet Durumu</p>
            <p className="font-semibold text-gray-900">
              {ihale.mulkiyet_durumu ? (MULKIYET_ETIKET[ihale.mulkiyet_durumu] ?? ihale.mulkiyet_durumu) : "Belirtilmemiş"}
            </p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <p className="text-xs text-amber-700 mb-0.5">Kayıtlı Başvuru Sahibi Adı (tapu ile karşılaştırın)</p>
            <p className="font-semibold text-amber-900">{ihale.basvuru_sahibi_adi ?? "—"}</p>
          </div>
          {ihale.mulkiyet_durumu === "sirket" && (
            <>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Şirket Unvanı</p>
                <p className="font-semibold text-gray-900">{ihale.sirket_unvani ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Yetkili Kişi Adı</p>
                <p className="font-semibold text-gray-900">{ihale.yetkili_kisi_adi ?? "—"}</p>
              </div>
            </>
          )}
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Ada / Parsel</p>
            <p className="font-semibold text-gray-900">{ihale.ada_no ?? "—"} / {ihale.parsel_no ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Mahalle</p>
            <p className="font-semibold text-gray-900">{ihale.mahalle ?? "—"}</p>
          </div>
        </div>
      </div>

      {/* Mülkiyet Belgeleri */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
        <h2 className="text-sm font-bold text-gray-900 mb-1">Mülkiyet Belgeleri</h2>
        <p className="text-xs text-gray-400 mb-4">Bu belgeler yalnızca admin tarafından görüntülenebilir.</p>
        <div className="flex flex-col gap-2">
          {tapuBelgesi ? (
            <BelgeSatiri belge={tapuBelgesi} imzaliUrl={imzaliUrller[tapuBelgesi.id]} />
          ) : (
            <p className="text-xs text-red-500">Tapu belgesi yüklenmemiş.</p>
          )}
          {vekaletnameBelgesi && <BelgeSatiri belge={vekaletnameBelgesi} imzaliUrl={imzaliUrller[vekaletnameBelgesi.id]} />}
          {imzaBelgesi && <BelgeSatiri belge={imzaBelgesi} imzaliUrl={imzaliUrller[imzaBelgesi.id]} />}
        </div>
      </div>

      {/* Diğer Belgeler */}
      {digerBelgeler.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
          <h2 className="text-sm font-bold text-gray-900 mb-4">Diğer Belgeler</h2>
          <div className="flex flex-col gap-2">
            {digerBelgeler.map((b) => <BelgeSatiri key={b.id} belge={b} />)}
          </div>
        </div>
      )}

      {/* Önceki red sebebi (varsa) */}
      {durum === "reddedildi" && ihale.red_sebebi && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 mb-6">
          <p className="text-xs font-semibold text-red-800 mb-1">Kayıtlı red sebebi</p>
          <p className="text-sm text-red-700">{ihale.red_sebebi}</p>
        </div>
      )}

      {/* İnceleme Aksiyonları */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-sm font-bold text-gray-900 mb-4">İnceleme Kararı</h2>
        <div className="flex gap-3 mb-4">
          <button
            onClick={onayla}
            disabled={islemYapiliyor || durum === "onaylandi"}
            className="flex-1 bg-green-600 text-white font-semibold py-2.5 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {durum === "onaylandi" ? "Onaylandı ✓" : "Onayla"}
          </button>
          <button
            onClick={() => setRedFormuAcik((v) => !v)}
            disabled={islemYapiliyor}
            className="flex-1 border border-red-200 text-red-600 font-semibold py-2.5 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            Reddet
          </button>
        </div>

        {redFormuAcik && (
          <form onSubmit={reddet} className="border-t border-gray-100 pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Red Sebebi <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {HIZLI_RED_SEBEPLERI.map((sebep) => (
                <button
                  key={sebep}
                  type="button"
                  onClick={() => hizliSebepEkle(sebep)}
                  className="text-xs font-medium text-gray-600 bg-gray-100 hover:bg-red-100 hover:text-red-700 px-3 py-1.5 rounded-full transition-colors"
                >
                  {sebep}
                </button>
              ))}
            </div>
            <textarea
              ref={redSebebiRef}
              required rows={3}
              placeholder="Örn: Yüklenen tapu belgesindeki isim başvuru sahibiyle eşleşmiyor... (yukarıdan hazır bir sebep seçip üzerine ekleme de yapabilirsiniz)"
              value={redSebebi}
              onChange={(e) => setRedSebebi(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none text-sm mb-3"
            />
            <button
              type="submit"
              disabled={islemYapiliyor || !redSebebi.trim()}
              className="bg-red-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {islemYapiliyor ? "Kaydediliyor…" : "Reddi Onayla"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
