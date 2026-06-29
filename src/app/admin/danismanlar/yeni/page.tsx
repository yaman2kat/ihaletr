"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { InsaatTuru } from "@/lib/types";

const UZMANLIKLAR: InsaatTuru[] = ["Kentsel Dönüşüm", "Kat Karşılığı", "Yapı İnşaat", "Bakım & Onarım"];

const IL_ILCELERI: Record<string, string[]> = {
  "Adana":      ["Seyhan", "Çukurova", "Yüreğir", "Sarıçam", "Ceyhan", "Kozan", "İmamoğlu", "Karataş", "Pozantı", "Tufanbeyli"],
  "Ankara":     ["Çankaya", "Keçiören", "Mamak", "Etimesgut", "Sincan", "Yenimahalle", "Altındağ", "Pursaklar", "Gölbaşı", "Polatlı", "Beypazarı"],
  "Antalya":    ["Muratpaşa", "Kepez", "Konyaaltı", "Alanya", "Manavgat", "Serik", "Aksu", "Döşemealtı", "Gazipaşa", "Kemer"],
  "Aydın":      ["Efeler", "Kuşadası", "Didim", "Söke", "Nazilli", "İncirliova", "Germencik", "Köşk", "Bozdoğan"],
  "Balıkesir":  ["Altıeylül", "Karesi", "Edremit", "Bandırma", "Burhaniye", "Ayvalık", "Gönen", "Erdek", "Susurluk"],
  "Bursa":      ["Osmangazi", "Yıldırım", "Nilüfer", "Gemlik", "İnegöl", "Gürsu", "Mudanya", "Kestel", "Mustafakemalpaşa", "Orhangazi"],
  "Diyarbakır": ["Bağlar", "Kayapınar", "Sur", "Yenişehir", "Ergani", "Silvan", "Bismil", "Çınar"],
  "Erzurum":    ["Yakutiye", "Palandöken", "Aziziye", "Oltu", "Horasan", "İspir", "Narman"],
  "Eskişehir":  ["Odunpazarı", "Tepebaşı", "Sivrihisar", "Çifteler", "Mihalıççık", "Mahmudiye"],
  "Gaziantep":  ["Şahinbey", "Şehitkamil", "Nizip", "İslahiye", "Oğuzeli", "Nurdağı", "Araban"],
  "Hatay":      ["Antakya", "İskenderun", "Defne", "Samandağ", "Kırıkhan", "Reyhanlı", "Dörtyol", "Erzin"],
  "İstanbul":   ["Adalar", "Arnavutköy", "Ataşehir", "Avcılar", "Bağcılar", "Bahçelievler", "Bakırköy", "Başakşehir", "Bayrampaşa", "Beşiktaş", "Beykoz", "Beylikdüzü", "Beyoğlu", "Büyükçekmece", "Çatalca", "Çekmeköy", "Esenler", "Esenyurt", "Eyüpsultan", "Fatih", "Gaziosmanpaşa", "Güngören", "Kadıköy", "Kağıthane", "Kartal", "Küçükçekmece", "Maltepe", "Pendik", "Sancaktepe", "Sarıyer", "Silivri", "Sultanbeyli", "Sultangazi", "Şile", "Şişli", "Tuzla", "Ümraniye", "Üsküdar", "Zeytinburnu"],
  "İzmir":      ["Konak", "Bornova", "Buca", "Karşıyaka", "Çiğli", "Karabağlar", "Balçova", "Bayraklı", "Gaziemir", "Torbalı", "Bergama", "Ödemiş", "Aliağa", "Foça", "Seferihisar", "Urla"],
  "Kayseri":    ["Melikgazi", "Kocasinan", "Talas", "İncesu", "Develi", "Pınarbaşı", "Bünyan"],
  "Kocaeli":    ["İzmit", "Gebze", "Darıca", "Körfez", "Gölcük", "Dilovası", "Başiskele", "Çayırova", "Derince", "Kandıra"],
  "Konya":      ["Selçuklu", "Meram", "Karatay", "Ereğli", "Akşehir", "Beyşehir", "Ilgın", "Cihanbeyli", "Seydişehir"],
  "Malatya":    ["Battalgazi", "Yeşilyurt", "Doğanşehir", "Akçadağ", "Darende", "Pütürge"],
  "Mersin":     ["Yenişehir", "Akdeniz", "Toroslar", "Mezitli", "Tarsus", "Erdemli", "Silifke", "Anamur", "Mut"],
  "Muğla":      ["Menteşe", "Bodrum", "Marmaris", "Fethiye", "Milas", "Ula", "Dalaman", "Köyceğiz", "Ortaca"],
  "Samsun":     ["Atakum", "Canik", "İlkadım", "Tekkeköy", "Bafra", "Terme", "Vezirköprü", "Alaçam"],
  "Sakarya":    ["Adapazarı", "Serdivan", "Erenler", "Arifiye", "Karasu", "Hendek", "Sapanca", "Pamukova"],
  "Şanlıurfa":  ["Karaköprü", "Eyyübiye", "Haliliye", "Suruç", "Birecik", "Viranşehir", "Siverek"],
  "Trabzon":    ["Ortahisar", "Akçaabat", "Araklı", "Of", "Vakfıkebir", "Çaykara", "Yomra"],
  "Van":        ["İpekyolu", "Tuşba", "Edremit", "Erciş", "Özalp", "Gevaş", "Muradiye"],
};

const ILLER = Object.keys(IL_ILCELERI).sort((a, b) => a.localeCompare(b, "tr"));

export default function YeniDanishman() {
  const router = useRouter();

  const [form, setForm] = useState({
    ad_soyad: "", telefon: "", email: "",
    deneyim_yili: "", biyografi: "", il: "", ilce: "",
  });
  const [uzmanliklar, setUzmanliklar]   = useState<InsaatTuru[]>([]);
  const [secilenIller, setSecilenIller] = useState<string[]>([]);
  const [yukleniyor, setYukleniyor]     = useState(false);
  const [hata, setHata]                 = useState("");

  const mevcutIlceleri = IL_ILCELERI[form.il] ?? [];

  function toggleUzmanlik(u: InsaatTuru) {
    setUzmanliklar((p) => p.includes(u) ? p.filter((x) => x !== u) : [...p, u]);
  }
  function toggleIl(il: string) {
    setSecilenIller((p) => p.includes(il) ? p.filter((x) => x !== il) : [...p, il]);
  }
  function guncelle(alan: string, deger: string) {
    setForm((f) => {
      if (alan === "il") return { ...f, il: deger, ilce: "" }; // il değişince ilçeyi sıfırla
      return { ...f, [alan]: deger };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.il)              { setHata("İkamet ili seçin.");              return; }
    if (uzmanliklar.length === 0) { setHata("En az bir uzmanlık alanı seçin."); return; }
    if (secilenIller.length === 0)  { setHata("En az bir çalışılan il seçin.");   return; }

    setHata(""); setYukleniyor(true);

    const { error } = await createClient().from("danismanlar").insert({
      ad_soyad:          form.ad_soyad,
      uzmanlik_alanlari: uzmanliklar,
      calistigi_iller:   secilenIller,
      il:                form.il,
      ilce:              form.ilce || null,
      telefon:           form.telefon,
      email:             form.email,
      deneyim_yili:      Number(form.deneyim_yili),
      biyografi:         form.biyografi,
    });

    setYukleniyor(false);
    if (error) { setHata("Kayıt başarısız: " + error.message); return; }
    router.push("/admin/danismanlar");
  }

  const Field = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );

  const inputCls = "w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm";

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/admin/danismanlar" className="text-gray-400 hover:text-gray-700 text-sm transition-colors">
          ← Danışmanlar
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900">Yeni Danışman Ekle</h1>
      </div>

      {hata && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-6">{hata}</div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">

        {/* Kişisel Bilgiler */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-5">Kişisel Bilgiler</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field label="Ad Soyad" required>
                <input required type="text" placeholder="Ahmet Yılmaz"
                  value={form.ad_soyad} onChange={(e) => guncelle("ad_soyad", e.target.value)} className={inputCls} />
              </Field>
            </div>
            <Field label="Telefon" required>
              <input required type="tel" placeholder="0532 123 45 67"
                value={form.telefon} onChange={(e) => guncelle("telefon", e.target.value)} className={inputCls} />
            </Field>
            <Field label="E-posta" required>
              <input required type="email" placeholder="ornek@mail.com"
                value={form.email} onChange={(e) => guncelle("email", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Deneyim Yılı" required>
              <input required type="number" min="1" max="60" placeholder="10"
                value={form.deneyim_yili} onChange={(e) => guncelle("deneyim_yili", e.target.value)} className={inputCls} />
            </Field>

            {/* İkamet: İl → İlçe cascade */}
            <Field label="İkamet İli" required>
              <select required value={form.il} onChange={(e) => guncelle("il", e.target.value)} className={inputCls + " bg-white"}>
                <option value="">İl seçin...</option>
                {ILLER.map((il) => <option key={il} value={il}>{il}</option>)}
              </select>
            </Field>
            <Field label="İkamet İlçesi">
              <select
                value={form.ilce} onChange={(e) => guncelle("ilce", e.target.value)}
                disabled={!form.il}
                className={inputCls + " bg-white disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"}
              >
                <option value="">{form.il ? `${form.il} ilçesi seçin...` : "Önce il seçin"}</option>
                {mevcutIlceleri.map((ilc) => <option key={ilc} value={ilc}>{ilc}</option>)}
              </select>
            </Field>

            <div className="sm:col-span-2">
              <Field label="Kısa Biyografi" required>
                <textarea required rows={4}
                  placeholder="Danışmanin deneyimi, uzmanlık alanları ve denetim yaklaşımını kısaca açıklayın..."
                  value={form.biyografi} onChange={(e) => guncelle("biyografi", e.target.value)}
                  className={inputCls + " resize-none"} />
              </Field>
            </div>
          </div>
        </div>

        {/* Uzmanlık Alanları */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Uzmanlık Alanları</h2>
          <p className="text-xs text-gray-400 mb-4">En az bir alan seçin</p>
          <div className="grid grid-cols-2 gap-3">
            {UZMANLIKLAR.map((u) => (
              <label key={u} className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${
                uzmanliklar.includes(u) ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
              }`}>
                <input type="checkbox" checked={uzmanliklar.includes(u)} onChange={() => toggleUzmanlik(u)} className="w-4 h-4 accent-blue-600" />
                <span className={`text-sm font-medium ${uzmanliklar.includes(u) ? "text-blue-700" : "text-gray-700"}`}>{u}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Çalıştığı İller */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-semibold text-gray-900">Hizmet Verdiği İller</h2>
            {secilenIller.length > 0 && (
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                {secilenIller.length} seçili
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mb-4">Danışmanin aktif olarak denetim yaptığı illeri seçin</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {ILLER.map((il) => (
              <label key={il} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all text-sm ${
                secilenIller.includes(il)
                  ? "border-blue-400 bg-blue-50 text-blue-700 font-medium"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}>
                <input type="checkbox" checked={secilenIller.includes(il)} onChange={() => toggleIl(il)} className="w-3.5 h-3.5 accent-blue-600 flex-shrink-0" />
                {il}
              </label>
            ))}
          </div>
        </div>

        {/* Butonlar */}
        <div className="flex gap-3">
          <button type="submit" disabled={yukleniyor}
            className="flex-1 bg-blue-700 text-white font-semibold py-3 rounded-xl hover:bg-blue-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
            {yukleniyor ? "Kaydediliyor..." : "Danışmani Kaydet"}
          </button>
          <Link href="/admin/danismanlar"
            className="px-6 py-3 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors text-center text-sm">
            İptal
          </Link>
        </div>
      </form>
    </div>
  );
}
