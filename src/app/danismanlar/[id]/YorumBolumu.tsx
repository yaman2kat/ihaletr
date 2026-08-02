"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { mockYorumlar } from "@/lib/mock-data";
import type { DanishmanYorum } from "@/lib/types";

// ─── Yıldız bileşeni ────────────────────────────────────────────────────────

function Yildizlar({ puan, boyut = "sm" }: { puan: number; boyut?: "sm" | "md" | "lg" }) {
  const cls = boyut === "lg" ? "w-6 h-6" : boyut === "md" ? "w-5 h-5" : "w-4 h-4";
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg key={s} className={`${cls} flex-shrink-0 ${s <= puan ? "text-yellow-400" : "text-gray-200"}`}
          fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

// ─── Seçilebilir yıldız ─────────────────────────────────────────────────────

function YildizSec({ deger, onChange }: { deger: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(0)}
          className="focus:outline-none"
          aria-label={`${s} yıldız`}
        >
          <svg className={`w-8 h-8 transition-colors ${s <= (hover || deger) ? "text-yellow-400" : "text-gray-200"}`}
            fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

// ─── Ana bileşen ─────────────────────────────────────────────────────────────

interface Props { danishmanId: string; }

export default function YorumBolumu({ danishmanId }: Props) {
  const [yorumlar, setYorumlar]       = useState<DanishmanYorum[]>([]);
  const [yukleniyor, setYukleniyor]   = useState(true);
  const [kullanici, setKullanici]     = useState<{ id: string; ad: string } | null>(null);
  const [puan, setPuan]               = useState(0);
  const [metin, setMetin]             = useState("");
  const [gonderiyor, setGonderiyor]   = useState(false);
  const [hata, setHata]               = useState("");
  const [basari, setBasari]           = useState(false);
  const [formGoster, setFormGoster]   = useState(false);

  const supabase = createClient();

  useEffect(() => {
    async function yukle() {
      // Kullanıcı oturumunu kontrol et
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profil } = await supabase
          .from("kullanicilar")
          .select("ad_soyad")
          .eq("id", session.user.id)
          .single();
        setKullanici({
          id: session.user.id,
          ad: profil?.ad_soyad ?? session.user.email?.split("@")[0] ?? "Kullanıcı",
        });
      }

      // Yorumları yükle
      const { data, error } = await supabase
        .from("danishman_yorumlar")
        .select("*")
        .eq("danishman_id", danishmanId)
        .order("created_at", { ascending: false });

      if (error || !data || data.length === 0) {
        setYorumlar(mockYorumlar.filter((y) => y.danishman_id === danishmanId));
      } else {
        setYorumlar(data as DanishmanYorum[]);
      }
      setYukleniyor(false);
    }
    yukle();
  }, [danishmanId]);

  async function handleGonder(e: React.FormEvent) {
    e.preventDefault();
    if (puan === 0) { setHata("Lütfen bir puan seçin."); return; }
    if (metin.trim().length < 10) { setHata("Yorum en az 10 karakter olmalıdır."); return; }
    if (!kullanici) return;

    setHata(""); setGonderiyor(true);

    const yeniYorum: Omit<DanishmanYorum, "id"> = {
      danishman_id: danishmanId,
      kullanici_id: kullanici.id,
      kullanici_adi: kullanici.ad,
      puan,
      yorum_metni: metin.trim(),
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("danishman_yorumlar").insert(yeniYorum);
    setGonderiyor(false);

    if (error) {
      setHata("Yorum gönderilemedi: " + error.message);
    } else {
      setBasari(true);
      setPuan(0); setMetin(""); setFormGoster(false);
      // Listeye ekle (optimistik)
      setYorumlar((prev) => [{ ...yeniYorum, id: crypto.randomUUID() }, ...prev]);
      setTimeout(() => setBasari(false), 4000);
    }
  }

  const ortalama = yorumlar.length
    ? Math.round((yorumlar.reduce((s, y) => s + y.puan, 0) / yorumlar.length) * 10) / 10
    : 0;

  function formatTarih(iso: string) {
    return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      {/* Başlık + Özet */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Değerlendirmeler</h2>
          {yorumlar.length > 0 && (
            <div className="flex items-center gap-3 mt-2">
              <span className="text-3xl font-bold text-gray-900">{ortalama.toFixed(1)}</span>
              <div>
                <Yildizlar puan={Math.round(ortalama)} boyut="md" />
                <p className="text-xs text-gray-500 mt-0.5">{yorumlar.length} değerlendirme</p>
              </div>
            </div>
          )}
        </div>
        {kullanici && !formGoster && (
          <button
            onClick={() => setFormGoster(true)}
            className="flex items-center gap-1.5 bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-blue-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Yorum Yaz
          </button>
        )}
      </div>

      {/* Başarı mesajı */}
      {basari && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl mb-5 flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          Yorumunuz başarıyla gönderildi, teşekkür ederiz!
        </div>
      )}

      {/* Yorum formu */}
      {formGoster && kullanici && (
        <form onSubmit={handleGonder} className="bg-blue-50 rounded-xl p-5 mb-6 border border-blue-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Değerlendirmenizi paylaşın</h3>

          <div className="mb-4">
            <p className="text-xs font-medium text-gray-700 mb-2">Puanınız</p>
            <YildizSec deger={puan} onChange={setPuan} />
          </div>

          <div className="mb-4">
            <label className="text-xs font-medium text-gray-700 mb-1 block">Yorum</label>
            <textarea
              rows={4}
              value={metin}
              onChange={(e) => setMetin(e.target.value)}
              placeholder="Destek uzmanıyla çalışma deneyiminizi paylaşın..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {hata && <p className="text-red-600 text-xs mb-3">{hata}</p>}

          <div className="flex gap-2">
            <button type="submit" disabled={gonderiyor}
              className="flex-1 bg-blue-700 text-white font-semibold text-sm py-2.5 rounded-xl hover:bg-blue-800 transition-colors disabled:opacity-60">
              {gonderiyor ? "Gönderiliyor..." : "Yorumu Gönder"}
            </button>
            <button type="button" onClick={() => { setFormGoster(false); setHata(""); setPuan(0); setMetin(""); }}
              className="px-4 py-2.5 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50 transition-colors">
              İptal
            </button>
          </div>
        </form>
      )}

      {/* Giriş yapılmamışsa uyarı */}
      {!kullanici && !yukleniyor && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 mb-6 text-center">
          <p className="text-sm text-gray-600">
            Yorum yazmak için{" "}
            <a href="/giris" className="text-blue-600 font-semibold hover:underline">giriş yapın</a>
          </p>
        </div>
      )}

      {/* Yorum listesi */}
      {yukleniyor ? (
        <div className="flex flex-col gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="flex gap-3 mb-2">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex-shrink-0" />
                <div className="flex-1">
                  <div className="h-3 bg-gray-200 rounded w-24 mb-1.5" />
                  <div className="h-3 bg-gray-200 rounded w-16" />
                </div>
              </div>
              <div className="h-12 bg-gray-100 rounded-xl" />
            </div>
          ))}
        </div>
      ) : yorumlar.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-2xl mb-2">💬</p>
          <p className="text-gray-500 text-sm">Henüz değerlendirme yok — ilk siz yazın!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {yorumlar.map((y) => (
            <div key={y.id} className="border-b border-gray-100 last:border-0 pb-5 last:pb-0">
              <div className="flex items-start gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 flex-shrink-0">
                  {y.kullanici_adi[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">{y.kullanici_adi}</p>
                    <p className="text-xs text-gray-400">{formatTarih(y.created_at)}</p>
                  </div>
                  <Yildizlar puan={y.puan} boyut="sm" />
                </div>
              </div>
              <p className="text-gray-600 text-sm leading-relaxed ml-11">{y.yorum_metni}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
