"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import IhaleKarti from "@/components/IhaleKarti";
import { mockIhaleler, mockIhaleTeklifleri } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";
import { gercekIhaleIdMi } from "@/lib/ihale-sonuc";
import type { Ihale } from "@/lib/types";

const KATEGORILER = ["Kentsel Dönüşüm", "Kat Karşılığı", "Yapı İnşaat", "Bakım & Onarım"];

type VarYok = "" | "var" | "yok";
type Siralama = "bitis" | "yeni" | "teklif";

// Secilen siralamadan bagimsiz olarak (her zaman) sona atilacak "bitmis"
// ihaleler: iptal/tamamlandi olarak isaretlenmis olanlar ya da suresi
// gecmis aktif ihaleler.
function ihaleBitmisMi(ihale: Ihale): boolean {
  if (ihale.durum === "tamamlandi" || ihale.durum === "iptal") return true;
  if (ihale.durum === "aktif") {
    const kalanGun = Math.ceil((new Date(ihale.bitis_tarihi).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return kalanGun <= 0;
  }
  return false;
}

function ChevronIkon({ acik }: { acik: boolean }) {
  return (
    <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${acik ? "rotate-180" : ""}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function Bolum({ baslik, children, defaultAcik = false }: { baslik: string; children: React.ReactNode; defaultAcik?: boolean }) {
  const [acik, setAcik] = useState(defaultAcik);
  return (
    <div className="border-b border-gray-100 py-4 last:border-b-0">
      <button
        type="button"
        onClick={() => setAcik((v) => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <h3 className="font-semibold text-gray-900 text-sm">{baslik}</h3>
        <ChevronIkon acik={acik} />
      </button>
      {acik && <div className="mt-3 flex flex-col gap-2">{children}</div>}
    </div>
  );
}

function VarYokSecici({ deger, onChange, etiket }: { deger: VarYok; onChange: (v: VarYok) => void; etiket: string }) {
  const SECENEKLER: { deger: VarYok; etiket: string }[] = [
    { deger: "", etiket: "Farketmez" },
    { deger: "var", etiket: "Var" },
    { deger: "yok", etiket: "Yok" },
  ];
  return (
    <div className="mb-1">
      <p className="text-xs text-gray-500 mb-1.5">{etiket}</p>
      <div className="flex gap-1.5">
        {SECENEKLER.map((s) => (
          <button
            key={s.deger}
            type="button"
            onClick={() => onChange(s.deger)}
            className={`flex-1 text-xs font-medium py-1.5 rounded-lg transition-colors ${
              deger === s.deger ? "bg-blue-100 text-blue-700" : "bg-gray-50 text-gray-500 hover:bg-gray-100"
            }`}
          >
            {s.etiket}
          </button>
        ))}
      </div>
    </div>
  );
}

const SELECT_CLS = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400";
const INPUT_CLS = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500";

function IhalelerIcerik() {
  const searchParams = useSearchParams();
  const urlKategori = searchParams.get("kategori") ?? "";

  const [arama,       setArama]       = useState("");
  const [siralama,    setSiralama]    = useState<Siralama>("bitis");

  const [il,       setIl]       = useState("");
  const [ilce,     setIlce]     = useState("");
  const [mahalle,  setMahalle]  = useState("");

  const [m2Min,     setM2Min]     = useState("");
  const [m2Max,     setM2Max]     = useState("");
  const [adaNo,     setAdaNo]     = useState("");
  const [parselNo,  setParselNo]  = useState("");

  const [turler, setTurler] = useState<string[]>(KATEGORILER.includes(urlKategori) ? [urlKategori] : []);

  const [ruhsat, setRuhsat] = useState<VarYok>("");
  const [proje,  setProje]  = useState<VarYok>("");

  const [sureAktif,  setSureAktif]  = useState(false);
  const [sureDolmus, setSureDolmus] = useState(false);
  const [bitisBaslangic, setBitisBaslangic] = useState("");
  const [bitisBitis,     setBitisBitis]     = useState("");

  const [dbIhaleler,     setDbIhaleler]     = useState<Ihale[]>([]);
  const [teklifSayilari, setTeklifSayilari] = useState<Record<string, number>>({});
  const [benimBekleyenlerim, setBenimBekleyenlerim] = useState<Ihale[]>([]);

  // Giris yapan kullanicinin kendi inceleme bekleyen ihaleleri -- RLS
  // (olusturan_id = auth.uid()) sayesinde yalnizca kendisi bu satirlari
  // cekebilir, baskasina hic gorunmez. Listede en ustte, ozel bir
  // rozetle gosterilir (bkz. asagidaki render).
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { setBenimBekleyenlerim([]); return; }
      const { data } = await supabase
        .from("ihaleler")
        .select("*")
        .eq("olusturan_id", session.user.id)
        .eq("inceleme_durumu", "beklemede")
        .order("created_at", { ascending: false });
      setBenimBekleyenlerim((data ?? []) as Ihale[]);
    });
  }, []);

  // Genel listede yalnizca admin incelemesinden gecmis (onaylandi) gercek
  // ihaleler gorunur -- beklemede/reddedildi olanlar RLS tarafindan zaten
  // bu sorgudan hariç tutulur, burada ayrica filtrelemek ek bir guvenlik
  // katmani saglar (bkz. ihale_gorunurluk_migration.sql).
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("ihaleler")
      .select("*")
      .eq("inceleme_durumu", "onaylandi")
      .order("created_at", { ascending: false })
      .then(async ({ data }) => {
        const ihaleler = (data ?? []) as Ihale[];
        setDbIhaleler(ihaleler);
        const idler = ihaleler.map((i) => i.id);
        if (idler.length > 0) {
          const { data: sayilar } = await supabase.rpc("ihale_teklif_sayilari", { p_ihale_idler: idler });
          setTeklifSayilari(Object.fromEntries(
            (sayilar ?? []).map((s: { ihale_id: string; sayi: number }) => [s.ihale_id, s.sayi])
          ));
        }
      });
  }, []);

  const tumIhaleler = useMemo(() => [...dbIhaleler, ...mockIhaleler], [dbIhaleler]);

  function teklifSayisiGetir(ihale: Ihale): number {
    return gercekIhaleIdMi(ihale.id)
      ? teklifSayilari[ihale.id] ?? 0
      : mockIhaleTeklifleri[ihale.id]?.length ?? 0;
  }

  const ilSecenekleri = useMemo(
    () => [...new Set(tumIhaleler.map((i) => i.sehir))].sort((a, b) => a.localeCompare(b, "tr")),
    [tumIhaleler]
  );
  const ilceSecenekleri = useMemo(() => {
    if (!il) return [];
    return [...new Set(tumIhaleler.filter((i) => i.sehir === il && i.ilce).map((i) => i.ilce as string))]
      .sort((a, b) => a.localeCompare(b, "tr"));
  }, [tumIhaleler, il]);
  const mahalleSecenekleri = useMemo(() => {
    if (!il) return [];
    return [...new Set(
      tumIhaleler
        .filter((i) => i.sehir === il && (!ilce || i.ilce === ilce) && i.mahalle)
        .map((i) => i.mahalle as string)
    )].sort((a, b) => a.localeCompare(b, "tr"));
  }, [tumIhaleler, il, ilce]);

  function toggleTur(kategori: string) {
    setTurler((p) => (p.includes(kategori) ? p.filter((k) => k !== kategori) : [...p, kategori]));
  }

  const aktifFiltreVarMi =
    arama || il || ilce || mahalle || m2Min || m2Max || adaNo || parselNo ||
    turler.length > 0 || ruhsat || proje || sureAktif || sureDolmus || bitisBaslangic || bitisBitis;

  function filtreleriTemizle() {
    setArama(""); setIl(""); setIlce(""); setMahalle("");
    setM2Min(""); setM2Max(""); setAdaNo(""); setParselNo("");
    setTurler([]); setRuhsat(""); setProje("");
    setSureAktif(false); setSureDolmus(false); setBitisBaslangic(""); setBitisBitis("");
  }

  const filtreliIhaleler = useMemo(() => {
    let sonuc = tumIhaleler;

    if (arama.trim()) {
      const k = arama.toLowerCase();
      sonuc = sonuc.filter(
        (i) =>
          i.baslik.toLowerCase().includes(k) ||
          i.kurum.toLowerCase().includes(k) ||
          i.sehir.toLowerCase().includes(k)
      );
    }

    if (il) sonuc = sonuc.filter((i) => i.sehir === il);
    if (ilce) sonuc = sonuc.filter((i) => i.ilce === ilce);
    if (mahalle) sonuc = sonuc.filter((i) => i.mahalle === mahalle);

    const m2MinSayi = m2Min ? Number(m2Min) : null;
    const m2MaxSayi = m2Max ? Number(m2Max) : null;
    if (m2MinSayi !== null) sonuc = sonuc.filter((i) => (i.yuzolcumu_m2 ?? 0) >= m2MinSayi);
    if (m2MaxSayi !== null) sonuc = sonuc.filter((i) => (i.yuzolcumu_m2 ?? 0) <= m2MaxSayi);

    if (adaNo.trim()) sonuc = sonuc.filter((i) => i.ada_no === adaNo.trim());
    if (parselNo.trim()) sonuc = sonuc.filter((i) => i.parsel_no === parselNo.trim());

    if (turler.length > 0) sonuc = sonuc.filter((i) => turler.includes(i.kategori));

    if (ruhsat) sonuc = sonuc.filter((i) => i.yapi_insaat_ruhsati === ruhsat);
    if (proje) sonuc = sonuc.filter((i) => i.proje === proje);

    if (sureAktif || sureDolmus) {
      sonuc = sonuc.filter((i) => {
        const bitmis = ihaleBitmisMi(i);
        return (sureAktif && !bitmis) || (sureDolmus && bitmis);
      });
    }

    if (bitisBaslangic) sonuc = sonuc.filter((i) => i.bitis_tarihi >= bitisBaslangic);
    if (bitisBitis) sonuc = sonuc.filter((i) => i.bitis_tarihi <= bitisBitis);

    sonuc = [...sonuc];
    if (siralama === "yeni") {
      sonuc.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (siralama === "bitis") {
      sonuc.sort((a, b) => new Date(a.bitis_tarihi).getTime() - new Date(b.bitis_tarihi).getTime());
    } else if (siralama === "teklif") {
      sonuc.sort((a, b) => teklifSayisiGetir(b) - teklifSayisiGetir(a));
    }

    // Kullanici ozellikle "sadece suresi dolanlar" filtrelemediyse, suresi
    // dolmus/tamamlanmis/iptal ihaleler secilen siralamadan bagimsiz olarak
    // her zaman en altta gosterilir.
    if (!(sureDolmus && !sureAktif)) {
      sonuc = [...sonuc.filter((i) => !ihaleBitmisMi(i)), ...sonuc.filter(ihaleBitmisMi)];
    }

    return sonuc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tumIhaleler, arama, il, ilce, mahalle, m2Min, m2Max, adaNo, parselNo,
    turler, ruhsat, proje, sureAktif, sureDolmus, bitisBaslangic, bitisBitis,
    siralama, teklifSayilari,
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">İhaleler</h1>
        <p className="text-gray-500">{filtreliIhaleler.length} ihale listeleniyor</p>
      </div>

      {benimBekleyenlerim.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            İnceleme Bekleyen İhaleleriniz
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {benimBekleyenlerim.map((ihale) => (
              <IhaleKarti
                key={ihale.id}
                ihale={ihale}
                ozelRozet={{ etiket: "Beklemede - Sadece siz görebilirsiniz", cls: "bg-amber-100 text-amber-800" }}
              />
            ))}
          </div>
        </div>
      )}

      <div className="relative mb-6">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="İhale, kurum veya şehir ara..."
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400 bg-white shadow-sm"
        />
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Filtre Paneli */}
        <aside className="lg:w-72 shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-bold text-gray-900">Filtreler</h2>
              {aktifFiltreVarMi && (
                <button type="button" onClick={filtreleriTemizle} className="text-xs text-blue-600 hover:underline">
                  Temizle
                </button>
              )}
            </div>

            <Bolum baslik="Sıralama" defaultAcik>
              <select value={siralama} onChange={(e) => setSiralama(e.target.value as Siralama)} className={SELECT_CLS}>
                <option value="bitis">Bitiş Tarihi (Yakın)</option>
                <option value="yeni">En Yeni</option>
                <option value="teklif">En Çok Teklif Alan</option>
              </select>
            </Bolum>

            <Bolum baslik="Konum" defaultAcik>
              <select
                value={il}
                onChange={(e) => { setIl(e.target.value); setIlce(""); setMahalle(""); }}
                className={SELECT_CLS}
              >
                <option value="">Tüm İller</option>
                {ilSecenekleri.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select
                value={ilce}
                onChange={(e) => { setIlce(e.target.value); setMahalle(""); }}
                disabled={!il || ilceSecenekleri.length === 0}
                className={SELECT_CLS}
              >
                <option value="">Tüm İlçeler</option>
                {ilceSecenekleri.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select
                value={mahalle}
                onChange={(e) => setMahalle(e.target.value)}
                disabled={!il || mahalleSecenekleri.length === 0}
                className={SELECT_CLS}
              >
                <option value="">Tüm Mahalleler</option>
                {mahalleSecenekleri.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Bolum>

            <Bolum baslik="Taşınmaz">
              <p className="text-xs text-gray-500 mb-1">Yüzölçümü (m²)</p>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" min="0" placeholder="Min" value={m2Min} onChange={(e) => setM2Min(e.target.value)} className={INPUT_CLS} />
                <input type="number" min="0" placeholder="Max" value={m2Max} onChange={(e) => setM2Max(e.target.value)} className={INPUT_CLS} />
              </div>
              <input placeholder="Ada No" value={adaNo} onChange={(e) => setAdaNo(e.target.value)} className={INPUT_CLS} />
              <input placeholder="Parsel No" value={parselNo} onChange={(e) => setParselNo(e.target.value)} className={INPUT_CLS} />
            </Bolum>

            <Bolum baslik="İhale Türü" defaultAcik>
              {KATEGORILER.map((k) => (
                <label key={k} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={turler.includes(k)}
                    onChange={() => toggleTur(k)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  {k}
                </label>
              ))}
            </Bolum>

            <Bolum baslik="Belgeler">
              <VarYokSecici deger={ruhsat} onChange={setRuhsat} etiket="Yapı İnşaat Ruhsatı" />
              <VarYokSecici deger={proje} onChange={setProje} etiket="Proje" />
            </Bolum>

            <Bolum baslik="Süre">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={sureAktif} onChange={(e) => setSureAktif(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                Aktif ihaleler
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={sureDolmus} onChange={(e) => setSureDolmus(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                Süresi dolanlar
              </label>
              <p className="text-xs text-gray-500 mt-2 mb-1">Bitiş tarihi aralığı</p>
              <div className="grid grid-cols-1 gap-2">
                <input type="date" value={bitisBaslangic} onChange={(e) => setBitisBaslangic(e.target.value)} className={INPUT_CLS} />
                <input type="date" value={bitisBitis} onChange={(e) => setBitisBitis(e.target.value)} className={INPUT_CLS} />
              </div>
            </Bolum>
          </div>
        </aside>

        {/* Sonuçlar */}
        <div className="flex-1">
          {filtreliIhaleler.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-16 text-center shadow-sm">
              <p className="text-gray-400 text-lg mb-2">Sonuç bulunamadı</p>
              <p className="text-gray-400 text-sm">Farklı filtreler deneyin</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filtreliIhaleler.map((ihale) => (
                <IhaleKarti key={ihale.id} ihale={ihale} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function IhalelerSayfasi() {
  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="h-8 bg-gray-100 rounded w-48 mb-8 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="bg-gray-100 rounded-xl h-64 animate-pulse" />
          ))}
        </div>
      </div>
    }>
      <IhalelerIcerik />
    </Suspense>
  );
}
