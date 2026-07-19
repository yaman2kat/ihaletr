"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { MuteahhitYorum } from "@/lib/types";
import { mockMuteahhitYorumlar } from "@/lib/mock-data";

function formatTarih(tarih: string) {
  return new Date(tarih).toLocaleDateString("tr-TR", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function Yildizlar({ puan, boyut = "sm" }: { puan: number; boyut?: "sm" | "md" }) {
  const cls = boyut === "md" ? "w-5 h-5" : "w-4 h-4";
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg key={s} className={`${cls} ${s <= puan ? "text-yellow-400" : "text-gray-200"}`}
          fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function YildizSec({ puan, onChange }: { puan: number; onChange: (p: number) => void }) {
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
        >
          <svg className={`w-7 h-7 transition-colors ${s <= (hover || puan) ? "text-yellow-400" : "text-gray-200"}`}
            fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

export default function YorumBolumu({ muteahhitId }: { muteahhitId: string }) {
  const [kullanici, setKullanici] = useState<User | null | undefined>(undefined);
  const [yorumlar, setYorumlar] = useState<MuteahhitYorum[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [puan, setPuan] = useState(0);
  const [metin, setMetin] = useState("");
  const [gonderiyor, setGonderiyor] = useState(false);
  const [hata, setHata] = useState("");
  const [basarili, setBasarili] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setKullanici(session?.user ?? null);
    });

    async function yorumlarGetir() {
      setYukleniyor(true);
      try {
        const { data, error } = await supabase
          .from("muteahhit_yorumlar")
          .select("*")
          .eq("muteahhit_id", muteahhitId)
          .order("created_at", { ascending: false });
        if (!error && data && data.length > 0) {
          setYorumlar(data as MuteahhitYorum[]);
        } else {
          setYorumlar(mockMuteahhitYorumlar.filter((y) => y.muteahhit_id === muteahhitId));
        }
      } catch {
        setYorumlar(mockMuteahhitYorumlar.filter((y) => y.muteahhit_id === muteahhitId));
      }
      setYukleniyor(false);
    }
    yorumlarGetir();
  }, [muteahhitId]);

  async function handleGonder(e: React.FormEvent) {
    e.preventDefault();
    if (puan === 0) { setHata("Lütfen bir puan seçin."); return; }
    if (metin.trim().length < 10) { setHata("Yorum en az 10 karakter olmalıdır."); return; }

    setGonderiyor(true);
    setHata("");

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setHata("Oturum süresi dolmuş."); setGonderiyor(false); return; }

    const kullaniciAdi =
      session.user.user_metadata?.ad_soyad ||
      session.user.email?.split("@")[0] ||
      "Kullanıcı";

    const yeniYorum: Omit<MuteahhitYorum, "id" | "created_at"> = {
      muteahhit_id: muteahhitId,
      kullanici_id: session.user.id,
      kullanici_adi: kullaniciAdi,
      puan,
      yorum_metni: metin.trim(),
    };

    try {
      const { error } = await supabase.from("muteahhit_yorumlar").insert(yeniYorum);
      if (error) throw error;
    } catch {
      // optimistik güncelleme
    }

    const optimistik: MuteahhitYorum = {
      ...yeniYorum,
      id: `opt-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    setYorumlar((prev) => [optimistik, ...prev]);
    setPuan(0);
    setMetin("");
    setBasarili(true);
    setGonderiyor(false);
    setTimeout(() => setBasarili(false), 4000);
  }

  const ortalama = yorumlar.length
    ? yorumlar.reduce((s, y) => s + y.puan, 0) / yorumlar.length
    : 0;

  return (
    <div id="yorumlar" className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 scroll-mt-24">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-900">Değerlendirmeler</h2>
        {yorumlar.length > 0 && (
          <div className="flex items-center gap-2">
            <Yildizlar puan={Math.round(ortalama)} boyut="md" />
            <span className="font-bold text-gray-900">{ortalama.toFixed(1)}</span>
            <span className="text-gray-400 text-sm">({yorumlar.length} yorum)</span>
          </div>
        )}
      </div>

      {kullanici && !basarili && (
        <form onSubmit={handleGonder} className="bg-gray-50 rounded-xl p-5 mb-6 border border-gray-100">
          <p className="text-sm font-semibold text-gray-700 mb-3">Değerlendirme Bırak</p>
          <div className="mb-3">
            <YildizSec puan={puan} onChange={setPuan} />
          </div>
          <textarea
            value={metin}
            onChange={(e) => setMetin(e.target.value)}
            placeholder="Bu müteahhitle çalışma deneyiminizi paylaşın…"
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-3"
          />
          {hata && <p className="text-red-600 text-xs mb-2">{hata}</p>}
          <button
            type="submit"
            disabled={gonderiyor}
            className="bg-blue-700 text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-60"
          >
            {gonderiyor ? "Gönderiliyor…" : "Yorum Gönder"}
          </button>
        </form>
      )}

      {basarili && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-5 py-3 mb-6">
          Değerlendirmeniz eklendi.
        </div>
      )}

      {kullanici === null && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 mb-6 text-sm text-blue-700">
          Değerlendirme bırakmak için{" "}
          <a href="/giris" className="font-semibold underline">giriş yapın</a>.
        </div>
      )}

      {yukleniyor ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-1/4 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-full mb-1" />
              <div className="h-3 bg-gray-100 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : yorumlar.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-6">
          Henüz değerlendirme yok. İlk yorumu siz yapın!
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-gray-100">
          {yorumlar.map((y) => (
            <div key={y.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">
                    {y.kullanici_adi.charAt(0)}
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{y.kullanici_adi}</span>
                </div>
                <span className="text-xs text-gray-400">{formatTarih(y.created_at)}</span>
              </div>
              <Yildizlar puan={y.puan} />
              <p className="text-sm text-gray-600 mt-2 leading-relaxed">{y.yorum_metni}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
