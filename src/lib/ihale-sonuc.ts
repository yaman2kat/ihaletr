import type { PlanTuru } from "./types";
import { PLAN_MAKS_IHALE_GUNU } from "./plan-limitleri";

const UUID_DESENI = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Mock/demo ihalelerin id'leri "1".."6" gibi kisa sabitlerdir; gercek
// veritabani ihaleleri uuid kullanir. Teklif gizliligi kurallari yalnizca
// gercek ihalelere uygulanir -- demo veri zaten sahte oldugu icin kisitlama
// gerektirmez.
export function gercekIhaleIdMi(id: string): boolean {
  return UUID_DESENI.test(id);
}

export interface SonucFirma {
  firmaAdi: string;
  tutar: number;
  muteahhitId?: string;
  ortalamaPuan: number | null;
  yorumSayisi: number;
  /** Yalnizca gercek ihalelerde, sahibi gorunumunde dolu: teklif satirinin
   * kullanici_id'si ve mevcut durumu -- "Kazandi olarak isaretle" butonu icin. */
  kullaniciId?: string;
  teklifDurumu?: "beklemede" | "kabul_edildi" | "reddedildi";
}

export interface IhaleSonucVerisi {
  ihaleId: string;
  ihaleBaslik: string;
  kurum: string;
  baslangicTarihi: string;
  bitisTarihi: string;
  firmalar: SonucFirma[];
}

export interface OzetIstatistik {
  enYuksek: number;
  enDusuk: number;
  ortalama: number;
}

export function ozetIstatistikHesapla(firmalar: SonucFirma[]): OzetIstatistik | null {
  if (firmalar.length === 0) return null;
  const tutarlar = firmalar.map((f) => f.tutar);
  return {
    enYuksek: Math.max(...tutarlar),
    enDusuk: Math.min(...tutarlar),
    ortalama: tutarlar.reduce((a, b) => a + b, 0) / tutarlar.length,
  };
}

export function formatPara(tutar: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency", currency: "TRY", minimumFractionDigits: 0,
  }).format(tutar);
}

export function formatTarih(tarih: string): string {
  return new Date(tarih).toLocaleDateString("tr-TR", {
    day: "numeric", month: "long", year: "numeric",
  });
}

// Toplam ihale süresi uzatma sınırı (gün). Premium/Kurumsal sınırları
// PLAN_MAKS_IHALE_GUNU'ndan (tek kaynak, ihale-olustur ile paylaşılır) gelir;
// Ücretsiz planın toplam uzatma sınırı ayrıca 30 gün olarak belirlenmiştir.
export const PLAN_UZATMA_LIMITI: Partial<Record<PlanTuru, number>> = {
  ucretsiz: 30,
  premium: PLAN_MAKS_IHALE_GUNU.premium,
  kurumsal: PLAN_MAKS_IHALE_GUNU.kurumsal,
};

export function gunFarki(baslangic: string, bitis: string): number {
  return Math.round((new Date(bitis).getTime() - new Date(baslangic).getTime()) / (1000 * 60 * 60 * 24));
}

export function tarihiGunEkleyerekUzat(tarih: string, eklenecekGun: number): string {
  const d = new Date(tarih);
  d.setDate(d.getDate() + eklenecekGun);
  return d.toISOString().split("T")[0];
}
