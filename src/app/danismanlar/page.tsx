"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getDanismanlarClient } from "@/lib/danismanlar";
import { mockYorumlar } from "@/lib/mock-data";
import type { InsaatTuru, InsaatAsamasi, Danishman } from "@/lib/types";

// ─── Yıldız ─────────────────────────────────────────────────────────────────

function Yildizlar({ puan }: { puan: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg key={s} className={`w-3.5 h-3.5 flex-shrink-0 ${s <= Math.round(puan) ? "text-yellow-400" : "text-gray-200"}`}
          fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

// ─── Sabit veriler ──────────────────────────────────────────────────────────

const ASAMALAR: { deger: InsaatAsamasi; ikon: string; aciklama: string }[] = [
  { deger: "Proje/Ruhsat",        ikon: "📐", aciklama: "Mimari proje kontrolü, ruhsat başvurusu ve onay süreçleri denetimi" },
  { deger: "Temel",               ikon: "⛏️", aciklama: "Zemin etüdü kontrolü, temel kazı ve beton dökümü denetimi" },
  { deger: "Kaba İnşaat",         ikon: "🏗️", aciklama: "Taşıyıcı sistem, kolon, kiriş, perde duvar ve çatı kontrolü" },
  { deger: "İnce İşler",          ikon: "🔧", aciklama: "Elektrik, sıhhi tesisat, sıva, seramik ve kaplama kontrolleri" },
  { deger: "Yapı Denetim/Teslim", ikon: "✅", aciklama: "Final muayenesi, kusur tespiti, teslimat raporu ve iskan işlemleri" },
];

const TURLER: { deger: InsaatTuru; ikon: string }[] = [
  { deger: "Kentsel Dönüşüm", ikon: "🏙️" },
  { deger: "Kat Karşılığı",   ikon: "🏢" },
  { deger: "Yapı İnşaat",     ikon: "🏗️" },
  { deger: "Bakım & Onarım",  ikon: "🔧" },
];

// Türkiye il → ilçe eşlemesi (24 büyük il)
const IL_ILCELERI: Record<string, string[]> = {
  "Adana":      ["Seyhan", "Çukurova", "Yüreğir", "Sarıçam", "Ceyhan", "Kozan", "İmamoğlu", "Karataş", "Pozantı", "Tufanbeyli", "Yumurtalık"],
  "Ankara":     ["Çankaya", "Keçiören", "Mamak", "Etimesgut", "Sincan", "Yenimahalle", "Altındağ", "Pursaklar", "Gölbaşı", "Polatlı", "Beypazarı", "Haymana", "Kazan"],
  "Antalya":    ["Muratpaşa", "Kepez", "Konyaaltı", "Alanya", "Manavgat", "Serik", "Aksu", "Döşemealtı", "Gazipaşa", "Kemer", "Elmalı", "Kumluca"],
  "Aydın":      ["Efeler", "Kuşadası", "Didim", "Söke", "Nazilli", "İncirliova", "Germencik", "Köşk", "Bozdoğan", "Çine"],
  "Balıkesir":  ["Altıeylül", "Karesi", "Edremit", "Bandırma", "Burhaniye", "Ayvalık", "Gönen", "Erdek", "Susurluk", "Bigadiç"],
  "Bursa":      ["Osmangazi", "Yıldırım", "Nilüfer", "Gemlik", "İnegöl", "Gürsu", "Mudanya", "Kestel", "Mustafakemalpaşa", "Orhangazi", "Karacabey"],
  "Diyarbakır": ["Bağlar", "Kayapınar", "Sur", "Yenişehir", "Ergani", "Silvan", "Bismil", "Çınar", "Hazro", "Kocaköy"],
  "Erzurum":    ["Yakutiye", "Palandöken", "Aziziye", "Oltu", "Horasan", "İspir", "Narman", "Karayazı"],
  "Eskişehir":  ["Odunpazarı", "Tepebaşı", "Sivrihisar", "Çifteler", "Mihalıççık", "Mahmudiye", "Beylikova"],
  "Gaziantep":  ["Şahinbey", "Şehitkamil", "Nizip", "İslahiye", "Oğuzeli", "Nurdağı", "Araban", "Karkamış"],
  "Hatay":      ["Antakya", "İskenderun", "Defne", "Samandağ", "Kırıkhan", "Reyhanlı", "Dörtyol", "Erzin", "Hassa", "Altınözü"],
  "İstanbul":   [
    "Adalar", "Arnavutköy", "Ataşehir", "Avcılar", "Bağcılar", "Bahçelievler", "Bakırköy",
    "Başakşehir", "Bayrampaşa", "Beşiktaş", "Beykoz", "Beylikdüzü", "Beyoğlu", "Büyükçekmece",
    "Çatalca", "Çekmeköy", "Esenler", "Esenyurt", "Eyüpsultan", "Fatih", "Gaziosmanpaşa",
    "Güngören", "Kadıköy", "Kağıthane", "Kartal", "Küçükçekmece", "Maltepe", "Pendik",
    "Sancaktepe", "Sarıyer", "Silivri", "Sultanbeyli", "Sultangazi", "Şile", "Şişli",
    "Tuzla", "Ümraniye", "Üsküdar", "Zeytinburnu",
  ],
  "İzmir":      ["Konak", "Bornova", "Buca", "Karşıyaka", "Çiğli", "Karabağlar", "Balçova", "Bayraklı", "Gaziemir", "Torbalı", "Bergama", "Ödemiş", "Aliağa", "Foça", "Seferihisar", "Urla", "Dikili"],
  "Kayseri":    ["Melikgazi", "Kocasinan", "Talas", "İncesu", "Develi", "Pınarbaşı", "Bünyan", "Yahyalı"],
  "Kocaeli":    ["İzmit", "Gebze", "Darıca", "Körfez", "Gölcük", "Dilovası", "Başiskele", "Çayırova", "Derince", "Kandıra", "Kartepe"],
  "Konya":      ["Selçuklu", "Meram", "Karatay", "Ereğli", "Akşehir", "Beyşehir", "Ilgın", "Cihanbeyli", "Seydişehir", "Kulu"],
  "Malatya":    ["Battalgazi", "Yeşilyurt", "Doğanşehir", "Akçadağ", "Darende", "Pütürge", "Doğanyol"],
  "Mersin":     ["Yenişehir", "Akdeniz", "Toroslar", "Mezitli", "Tarsus", "Erdemli", "Silifke", "Anamur", "Mut", "Gülnar"],
  "Muğla":      ["Menteşe", "Bodrum", "Marmaris", "Fethiye", "Milas", "Ula", "Dalaman", "Köyceğiz", "Ortaca", "Seydikemer"],
  "Samsun":     ["Atakum", "Canik", "İlkadım", "Tekkeköy", "Bafra", "Terme", "Vezirköprü", "Alaçam", "Salıpazarı"],
  "Sakarya":    ["Adapazarı", "Serdivan", "Erenler", "Arifiye", "Karasu", "Hendek", "Sapanca", "Pamukova", "Geyve"],
  "Şanlıurfa":  ["Karaköprü", "Eyyübiye", "Haliliye", "Suruç", "Birecik", "Viranşehir", "Siverek", "Akçakale"],
  "Trabzon":    ["Ortahisar", "Akçaabat", "Araklı", "Of", "Vakfıkebir", "Çaykara", "Yomra", "Düzköy"],
  "Van":        ["İpekyolu", "Tuşba", "Edremit", "Erciş", "Özalp", "Gevaş", "Muradiye", "Çaldıran"],
};

const ILLER = Object.keys(IL_ILCELERI).sort((a, b) => a.localeCompare(b, "tr"));

// ─── Eşleştirme ─────────────────────────────────────────────────────────────

function hesaplaPuan(d: Danishman, tur: InsaatTuru, secilenIl: string, secilenIlce: string): number {
  const uzmanlik = d.uzmanlik_alanlari.includes(tur) ? 15 : 0;

  const ilEslesti = (d.calistigi_iller ?? []).includes(secilenIl) || d.il === secilenIl;
  const ilceEslesti = secilenIlce !== "" && d.ilce === secilenIlce;

  const konum = ilEslesti && ilceEslesti ? 15
              : ilEslesti                 ?  8
              :                              0;

  const deneyim = Math.min(d.deneyim_yili, 15);
  return uzmanlik + konum + deneyim;
}

// ─── İlerleme göstergesi ─────────────────────────────────────────────────────

type Adim = "giris" | "asama" | "tur" | "konum" | "sonuc";
// Tüm adım sırası (geriDon/ilerle için)
const ADIM_SIRASI: Adim[] = ["giris", "asama", "tur", "konum", "sonuc"];
// Progress bar'da yalnızca wizard adımları gösterilir
const WIZARD_SIRASI: Adim[] = ["asama", "tur", "konum", "sonuc"];
const ADIM_ETIKET = ["Aşama", "Tür", "Konum"];

function Ilerleme({ adim }: { adim: Adim }) {
  const mevcut = WIZARD_SIRASI.indexOf(adim); // 0=asama, 1=tur, 2=konum, 3=sonuc
  return (
    <div className="flex items-center mb-8">
      {ADIM_ETIKET.map((e, i) => (
        <div key={e} className="flex items-center flex-1 last:flex-none">
          <div className="flex items-center gap-1.5">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
              i < mevcut  ? "bg-blue-600 text-white"
            : i === mevcut ? "bg-blue-700 text-white ring-4 ring-blue-100"
            :                "bg-gray-100 text-gray-400"
            }`}>
              {i < mevcut ? "✓" : i + 1}
            </div>
            <span className={`text-xs font-semibold hidden sm:block ${
              i === mevcut ? "text-blue-700" : i < mevcut ? "text-blue-500" : "text-gray-400"
            }`}>{e}</span>
          </div>
          {i < ADIM_ETIKET.length - 1 && (
            <div className={`flex-1 h-0.5 mx-3 transition-colors ${i < mevcut ? "bg-blue-400" : "bg-gray-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Ana bileşen ──────────────────────────────────────────────────────────────

interface Eslesme { danishman: Danishman; puan: number; }

export default function DanismanlarSayfasi() {
  const [adim, setAdim]           = useState<Adim>("giris");
  const [asama, setAsama]         = useState<InsaatAsamasi | "">("");
  const [tur, setTur]             = useState<InsaatTuru | "">("");
  const [il, setIl]               = useState("");
  const [ilce, setIlce]           = useState("");
  const [sonuclar, setSonuclar]   = useState<Eslesme[]>([]);
  const [danismanlar, setDanismanlar] = useState<Danishman[]>([]);
  const [veriYuklendi, setVeriYuklendi] = useState(false);

  useEffect(() => {
    getDanismanlarClient().then((data) => {
      setDanismanlar(data);
      setVeriYuklendi(true);
    });
  }, []);

  function handleIlDegis(yeniIl: string) {
    setIl(yeniIl);
    setIlce(""); // il değişince ilçeyi sıfırla
  }

  function ilerle(sonrakiAdim: Adim) {
    if (sonrakiAdim === "sonuc") {
      const eslesmeler = danismanlar
        .map((d) => ({ danishman: d, puan: hesaplaPuan(d, tur as InsaatTuru, il, ilce) }))
        .sort((a, b) => b.puan - a.puan);
      setSonuclar(eslesmeler);
    }
    setAdim(sonrakiAdim);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function geriDon() {
    const i = ADIM_SIRASI.indexOf(adim);
    if (i > 0) setAdim(ADIM_SIRASI[i - 1]);
  }

  function sifirla() {
    setAdim("giris"); setAsama(""); setTur(""); setIl(""); setIlce(""); setSonuclar([]);
  }

  const ilceleri = IL_ILCELERI[il] ?? [];

  return (
    <div>
      {/* ─── Hero ─── */}
      <section className="bg-gradient-to-br from-blue-800 to-blue-950 text-white py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-block text-xs font-bold bg-blue-700/60 text-blue-200 px-3 py-1 rounded-full mb-5 tracking-wide uppercase">
            Bağımsız Denetim
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
            Bağımsız İnşaat Danışmanı Bulun
          </h1>
          <p className="text-blue-100 text-base leading-relaxed max-w-2xl mx-auto">
            Yükleniciden, arsa sahibinden ve belediyeden tamamen bağımsız uzman danışmanlar — inşaatınızı başından sonuna denetler, haklarınızı korur.
          </p>
        </div>
      </section>

      {/* ─── Özellik bantı ─── */}
      <section className="bg-white border-b border-gray-100 py-8 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { ikon: "🔍", baslik: "Tamamen Tarafsız",   aciklama: "Yükleniciden ve arsa sahibinden bağımsız; yalnızca sizin adınıza denetim yapar" },
            { ikon: "📋", baslik: "Her Aşamada Yanınızda", aciklama: "Proje onayından iskan belgesine kadar her kritik noktada sahada aktif kontrol" },
            { ikon: "🛡️", baslik: "Yazılı Güvence",    aciklama: "Resmi denetim raporları ve belgeleriyle haklarınız yasal olarak koruma altında" },
          ].map((o) => (
            <div key={o.baslik} className="flex items-start gap-4 p-4">
              <span className="text-2xl flex-shrink-0">{o.ikon}</span>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm mb-1">{o.baslik}</h3>
                <p className="text-gray-500 text-xs leading-relaxed">{o.aciklama}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Wizard / Sonuçlar ─── */}
      <section className="py-12 px-4 bg-gray-50 min-h-[60vh]">
        <div className="max-w-2xl mx-auto">

          {/* ─── GİRİŞ EKRANI ─── */}
          {adim === "giris" && (
            <div>
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Size nasıl yardımcı olabiliriz?</h2>
                <p className="text-gray-500 text-sm">Aşağıdaki seçenekten devam edin</p>
              </div>
              <div className="max-w-md mx-auto">
                {/* Bilgi / İletişim */}
                <Link
                  href="/iletisim"
                  className="group flex flex-col gap-4 bg-white border-2 border-gray-200 hover:border-blue-400 rounded-2xl p-7 shadow-sm hover:shadow-md transition-all text-left"
                >
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 group-hover:bg-blue-50 flex items-center justify-center transition-colors flex-shrink-0">
                    <svg className="w-7 h-7 text-gray-500 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base mb-1.5 group-hover:text-blue-700 transition-colors">
                      Sistem hakkında bilgi almak istiyorum
                    </h3>
                    <p className="text-gray-500 text-sm leading-relaxed">
                      Platform nasıl çalışır, fiyatlandırma, teknik destek veya genel sorularınız için iletişim bilgilerimize ulaşın.
                    </p>
                  </div>
                  <span className="text-blue-600 text-sm font-semibold flex items-center gap-1 mt-auto">
                    İletişim Sayfasına Git
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </Link>
              </div>
            </div>
          )}

          {/* ─── WIZARD ───
              GEÇİCİ: Otomatik danışman atama/eşleştirme özelliği şimdilik
              devre dışı — giriş ekranındaki tetikleyici buton kaldırıldığı
              için bu adımlara artık ulaşılamıyor. Kod ileride tekrar
              etkinleştirmek için burada bırakıldı. */}
          {adim !== "giris" && adim !== "sonuc" && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
              <Ilerleme adim={adim} />

              {/* ADIM 1 — Aşama */}
              {adim === "asama" && (
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">İnşaatınız hangi aşamada?</h2>
                  <p className="text-gray-500 text-sm mb-6">Mevcut duruma göre o aşamada uzman danışmanları önerelim.</p>
                  <div className="flex flex-col gap-2.5">
                    {ASAMALAR.map((a) => (
                      <button
                        key={a.deger}
                        type="button"
                        onClick={() => { setAsama(a.deger); ilerle("tur"); }}
                        className={`flex items-start gap-4 px-5 py-4 rounded-xl border-2 text-left transition-all ${
                          asama === a.deger
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-blue-300 hover:bg-blue-50/40"
                        }`}
                      >
                        <span className="text-xl flex-shrink-0 mt-0.5">{a.ikon}</span>
                        <div>
                          <p className={`font-semibold text-sm ${asama === a.deger ? "text-blue-700" : "text-gray-900"}`}>
                            {a.deger}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">{a.aciklama}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ADIM 2 — İnşaat Türü */}
              {adim === "tur" && (
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">İnşaat türünü seçin</h2>
                  <p className="text-gray-500 text-sm mb-6">Projenizin kategorisine göre uzman danışman eşleştirelim.</p>
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    {TURLER.map((t) => (
                      <button
                        key={t.deger}
                        type="button"
                        onClick={() => setTur(t.deger)}
                        className={`flex items-center gap-3 px-4 py-4 rounded-xl border-2 text-left transition-all ${
                          tur === t.deger
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-gray-200 text-gray-700 hover:border-blue-300"
                        }`}
                      >
                        <span className="text-xl flex-shrink-0">{t.ikon}</span>
                        <span className="font-semibold text-sm">{t.deger}</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <button onClick={geriDon} className="px-5 py-2.5 border border-gray-200 rounded-xl text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors">
                      Geri
                    </button>
                    <button
                      onClick={() => ilerle("konum")}
                      disabled={!tur}
                      className="flex-1 bg-blue-700 text-white font-semibold py-2.5 rounded-xl hover:bg-blue-800 transition-colors disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      Devam Et
                    </button>
                  </div>
                </div>
              )}

              {/* ADIM 3 — Konum (İl + İlçe) */}
              {adim === "konum" && (
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">İnşaatın bulunduğu yer</h2>
                  <p className="text-gray-500 text-sm mb-6">Konuma en yakın uzman danışmanları gösterelim.</p>

                  {/* İl seçimi */}
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      İl <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={il}
                      onChange={(e) => handleIlDegis(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="">İl seçin...</option>
                      {ILLER.map((i) => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>

                  {/* İlçe seçimi — il seçilince aktif olur */}
                  <div className="mb-6">
                    <label className={`block text-sm font-semibold mb-2 ${il ? "text-gray-700" : "text-gray-300"}`}>
                      İlçe
                      <span className="ml-1.5 text-xs font-normal text-gray-400">(isteğe bağlı — daha kesin eşleşme için)</span>
                    </label>
                    <select
                      value={ilce}
                      onChange={(e) => setIlce(e.target.value)}
                      disabled={!il}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      <option value="">{il ? `Tüm ${il} ilçeleri` : "Önce il seçin"}</option>
                      {ilceleri.map((ilc) => <option key={ilc} value={ilc}>{ilc}</option>)}
                    </select>
                    {il && ilce && (
                      <p className="text-xs text-blue-600 mt-1.5 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        {il} / {ilce} seçildi — ilçe bazında eşleştirme yapılacak
                      </p>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button onClick={geriDon} className="px-5 py-2.5 border border-gray-200 rounded-xl text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors">
                      Geri
                    </button>
                    <button
                      onClick={() => ilerle("sonuc")}
                      disabled={!il || !veriYuklendi}
                      className="flex-1 bg-blue-700 text-white font-semibold py-2.5 rounded-xl hover:bg-blue-800 transition-colors disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      {!veriYuklendi ? "Yükleniyor..." : "Danışman Öner"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── SONUÇLAR ─── */}
          {adim === "sonuc" && (
            <div className="flex flex-col gap-5">
              {/* Özet bandı */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-blue-500 uppercase tracking-wide mb-1">Arama Kriterleri</p>
                  <p className="text-blue-900 font-semibold text-sm">
                    {asama} · {tur} · {il}{ilce ? ` / ${ilce}` : ""}
                  </p>
                </div>
                <button onClick={sifirla} className="text-blue-600 text-sm font-semibold hover:underline whitespace-nowrap">
                  Yeniden Ara
                </button>
              </div>

              {sonuclar.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                  <p className="text-2xl mb-3">🔍</p>
                  <p className="text-gray-600 font-medium mb-1">Eşleşen danışman bulunamadı</p>
                  <p className="text-gray-400 text-sm mb-5">Farklı il veya ilçe deneyin</p>
                  <button onClick={sifirla} className="text-blue-600 hover:underline text-sm font-medium">
                    Aramayı Sıfırla
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2 h-2 bg-green-500 rounded-full" />
                      <p className="text-xs font-bold text-green-700 uppercase tracking-wide">Önerilen Danışman</p>
                    </div>
                    <DanishmanKarti danishman={sonuclar[0].danishman} onerilen secilenIl={il} secilenIlce={ilce} />
                  </div>
                  {sonuclar.length > 1 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-2 h-2 bg-gray-300 rounded-full" />
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Diğer Seçenekler</p>
                      </div>
                      <div className="flex flex-col gap-4">
                        {sonuclar.slice(1, 3).map((s) => (
                          <DanishmanKarti key={s.danishman.id} danishman={s.danishman} secilenIl={il} secilenIlce={ilce} />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// ─── Danışman Kartı ──────────────────────────────────────────────────────────

interface DanishmanKartiProps {
  danishman: Danishman;
  onerilen?: boolean;
  secilenIl: string;
  secilenIlce: string;
}

function DanishmanKarti({ danishman: d, onerilen, secilenIl, secilenIlce }: DanishmanKartiProps) {
  const ilEslesti   = (d.calistigi_iller ?? []).includes(secilenIl) || d.il === secilenIl;
  const ilceEslesti = secilenIlce !== "" && d.ilce === secilenIlce;
  const tamEslesti  = ilEslesti && ilceEslesti;

  // Ortalama puan
  const yorumlar = mockYorumlar.filter((y) => y.danishman_id === d.id);
  const ortalama = yorumlar.length
    ? yorumlar.reduce((s, y) => s + y.puan, 0) / yorumlar.length
    : 0;

  return (
    <div className={`bg-white rounded-2xl border-2 shadow-sm p-6 ${onerilen ? "border-blue-500" : "border-gray-200"}`}>
      {onerilen && (
        <div className="flex items-center gap-1.5 mb-4">
          <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <span className="text-sm font-bold text-blue-600">En Uygun Eşleşme</span>
        </div>
      )}

      {/* Başlık satırı */}
      <div className="flex items-center gap-4 mb-4">
        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-lg font-bold text-blue-700 flex-shrink-0">
          {d.ad_soyad.split(" ").map((n) => n[0]).join("").slice(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 text-base">{d.ad_soyad}</h3>
          <p className="text-xs text-gray-500">Bağımsız İnşaat Danışmanı</p>
          {yorumlar.length > 0 && (
            <div className="flex items-center gap-1.5 mt-1">
              <Yildizlar puan={ortalama} />
              <span className="text-[11px] text-gray-400">{ortalama.toFixed(1)} ({yorumlar.length})</span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="bg-gray-100 text-gray-700 text-sm font-bold px-3 py-1 rounded-full">
            {d.deneyim_yili} yıl
          </span>
          {tamEslesti ? (
            <span className="text-[10px] font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Tam eşleşme</span>
          ) : ilEslesti ? (
            <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">İl eşleşmesi</span>
          ) : null}
        </div>
      </div>

      {/* Uzmanlık alanları */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {d.uzmanlik_alanlari.map((u) => (
          <span key={u} className="bg-blue-50 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full">{u}</span>
        ))}
      </div>

      {/* Konum */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className="flex items-center gap-1 text-xs text-gray-500">
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {d.ilce ? `${d.ilce}, ` : ""}{d.il ?? (d.calistigi_iller ?? [])[0]}
        </span>
        {(d.calistigi_iller ?? []).length > 1 && (
          <span className="text-xs text-gray-400">
            · {(d.calistigi_iller ?? []).slice(0, 3).join(", ")}
            {(d.calistigi_iller ?? []).length > 3 ? ` +${(d.calistigi_iller ?? []).length - 3} il` : ""}
          </span>
        )}
      </div>

      {/* Biyografi */}
      <p className="text-gray-600 text-sm leading-relaxed mb-4 line-clamp-2">{d.biyografi}</p>

      {/* İletişim */}
      <div className="flex flex-wrap gap-3 mb-5">
        <a href={`tel:${d.telefon.replace(/\s/g, "")}`}
          className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-blue-700 transition-colors">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          {d.telefon}
        </a>
        <a href={`mailto:${d.email}`}
          className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-blue-700 transition-colors">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          {d.email}
        </a>
      </div>

      <Link
        href={`/danismanlar/${d.id}`}
        className="block w-full text-center bg-blue-700 text-white font-semibold py-2.5 rounded-xl hover:bg-blue-800 transition-colors text-sm"
      >
        Profili İncele
      </Link>
    </div>
  );
}
