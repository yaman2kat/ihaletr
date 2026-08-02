"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Davet, OdulTuru } from "@/lib/types";

interface AktifIhale {
  id: string;
  baslik: string;
}

interface DavetKartProps {
  userId: string;
  onOduluUygulandi?: () => void;
}

export default function DavetKart({ userId, onOduluUygulandi }: DavetKartProps) {
  const [davetKodu,     setDavetKodu]     = useState<string | null>(null);
  const [davetler,      setDavetler]      = useState<Davet[]>([]);
  const [aktifIhaleler, setAktifIhaleler] = useState<AktifIhale[]>([]);
  const [yukleniyor,    setYukleniyor]    = useState(true);
  const [odulIslemde,   setOdulIslemde]   = useState<string | null>(null);
  const [odulHata,      setOdulHata]      = useState<string | null>(null);
  const [secilenIhale,  setSecilenIhale]  = useState<Record<string, string>>({});
  const [kopyalandi,    setKopyalandi]    = useState(false);

  const supabase = createClient();

  useEffect(() => {
    async function yukle() {
      const [profilRes, davetRes, ihaleRes] = await Promise.all([
        supabase.from("kullanicilar").select("davet_kodu").eq("id", userId).single(),
        supabase.from("davetler")
          .select("*, davet_edilen:kullanicilar!davetler_davet_edilen_id_fkey(ad_soyad)")
          .eq("davet_eden_id", userId)
          .eq("odul_verildi", false)
          .order("created_at", { ascending: false }),
        supabase.from("ihaleler").select("id, baslik").eq("olusturan_id", userId).eq("durum", "aktif"),
      ]);

      setDavetKodu(profilRes.data?.davet_kodu ?? null);
      setDavetler((davetRes.data ?? []) as Davet[]);
      setAktifIhaleler((ihaleRes.data ?? []) as AktifIhale[]);
      setYukleniyor(false);
    }
    yukle();
  }, [userId]);

  function davetLinki(kod: string) {
    return `${window.location.origin}/kayit?ref=${kod}`;
  }

  async function handleKopyala() {
    if (!davetKodu) return;
    await navigator.clipboard.writeText(davetLinki(davetKodu));
    setKopyalandi(true);
    setTimeout(() => setKopyalandi(false), 2500);
  }

  async function handleOdulUygula(davetId: string, tur: OdulTuru, ihaleId?: string) {
    setOdulHata(null);
    setOdulIslemde(davetId);
    const { error } = await supabase.rpc("davet_odulu_uygula", {
      p_davet_id: davetId,
      p_odul_turu: tur,
      p_ihale_id: tur === "sure_uzatma" ? ihaleId : null,
    });

    if (error) {
      setOdulHata(error.message);
    } else {
      setDavetler((p) => p.filter((d) => d.id !== davetId));
      onOduluUygulandi?.();
    }
    setOdulIslemde(null);
  }

  if (yukleniyor) {
    return <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-8 h-40 animate-pulse" />;
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-8">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">🎁</span>
        <h2 className="text-lg font-bold text-gray-900">Arkadaşını Davet Et</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Kendi davet linkinle bir arkadaşın kayıt olup e-postasını onaylasın, sen de ödül kazan:
        müteahhit hesaplara +1 teklif hakkı, arsa sahibi hesaplara aktif bir ihaleye 15 gün ekstra süre otomatik tanımlanır.
      </p>

      {davetKodu && (
        <div className="flex flex-col sm:flex-row gap-2 mb-5">
          <input
            readOnly
            value={davetLinki(davetKodu)}
            onFocus={(e) => e.target.select()}
            className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-gray-700 bg-gray-50 text-sm truncate"
          />
          <button
            onClick={handleKopyala}
            className="flex-shrink-0 bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-blue-800 transition-colors text-sm"
          >
            {kopyalandi ? "Kopyalandı ✓" : "Linki Kopyala"}
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`İhaleTR'de ihalelere göz atmaya ne dersin? Bu linkle kayıt ol: ${davetLinki(davetKodu)}`)}`}
            target="_blank" rel="noopener noreferrer"
            className="flex-shrink-0 bg-green-600 text-white font-semibold px-4 py-2.5 rounded-lg hover:bg-green-700 transition-colors text-sm text-center"
          >
            WhatsApp
          </a>
          <a
            href={`mailto:?subject=${encodeURIComponent("İhaleTR'ye davetlisin")}&body=${encodeURIComponent(`Merhaba,\n\nİhaleTR'de ihalelere göz atmaya ne dersin? Bu linkle kayıt olabilirsin:\n${davetLinki(davetKodu)}`)}`}
            className="flex-shrink-0 bg-gray-100 text-gray-700 font-semibold px-4 py-2.5 rounded-lg hover:bg-gray-200 transition-colors text-sm text-center"
          >
            E-posta
          </a>
        </div>
      )}

      {odulHata && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-4">
          {odulHata}
        </div>
      )}

      {davetler.length > 0 && (
        <div className="border-t border-gray-100 pt-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">
            {davetler.length === 1 ? "1 ödül seni bekliyor 🎉" : `${davetler.length} ödül seni bekliyor 🎉`}
          </p>
          <div className="flex flex-col gap-3">
            {davetler.map((d) => {
              const turBelli = d.odul_turu; // null (her_ikisi: serbest seçim) | 'teklif_hakki' | 'sure_uzatma' (önceden belirlenmiş)
              return (
                <div key={d.id} className="bg-gray-50 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <p className="text-sm text-gray-700 flex-1">
                    <span className="font-semibold">{d.davet_edilen?.ad_soyad ?? "Davet ettiğin kişi"}</span>{" "}
                    kaydını onayladı.{" "}
                    {turBelli === "sure_uzatma"
                      ? "Süre uzatma ödülünü hangi ihaleye uygulamak istersin?"
                      : turBelli === "teklif_hakki"
                      ? "Teklif hakkı ödülün hazır:"
                      : "Ödülünü seç:"}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {(turBelli === null || turBelli === "teklif_hakki") && (
                      <button
                        disabled={odulIslemde === d.id}
                        onClick={() => handleOdulUygula(d.id, "teklif_hakki")}
                        className="text-xs font-bold bg-teal-600 text-white px-3 py-2 rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
                      >
                        +1 Teklif Hakkı
                      </button>
                    )}

                    {(turBelli === null || turBelli === "sure_uzatma") && (
                      <>
                        {aktifIhaleler.length === 0 && (
                          <span className="text-xs text-gray-400 px-3 py-2">Süre uzatma için aktif ihalen yok</span>
                        )}

                        {aktifIhaleler.length === 1 && (
                          <button
                            disabled={odulIslemde === d.id}
                            onClick={() => handleOdulUygula(d.id, "sure_uzatma", aktifIhaleler[0].id)}
                            className="text-xs font-bold bg-amber-500 text-white px-3 py-2 rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
                          >
                            15 Gün Süre Ver ({aktifIhaleler[0].baslik})
                          </button>
                        )}

                        {aktifIhaleler.length > 1 && (
                          <>
                            <select
                              value={secilenIhale[d.id] ?? aktifIhaleler[0].id}
                              onChange={(e) => setSecilenIhale((p) => ({ ...p, [d.id]: e.target.value }))}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-2 bg-white text-gray-700"
                            >
                              {aktifIhaleler.map((ih) => (
                                <option key={ih.id} value={ih.id}>{ih.baslik}</option>
                              ))}
                            </select>
                            <button
                              disabled={odulIslemde === d.id}
                              onClick={() => handleOdulUygula(d.id, "sure_uzatma", secilenIhale[d.id] ?? aktifIhaleler[0].id)}
                              className="text-xs font-bold bg-amber-500 text-white px-3 py-2 rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
                            >
                              15 Gün Süre Ver
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
