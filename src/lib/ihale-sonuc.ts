import type { PlanTuru } from "./types";
import { PLAN_TOPLAM_MAKS_IHALE_GUNU } from "./plan-limitleri";

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
  /** Kat Karşılığı/Kentsel Dönüşüm gibi dosya tabanlı tekliflerde tutar
   * bulunmaz -- null, "Dosya ile teklif" olarak gösterilir. */
  tutar: number | null;
  muteahhitId?: string;
  ortalamaPuan: number | null;
  yorumSayisi: number;
  /** Yalnizca gercek ihalelerde, sahibi gorunumunde dolu: teklif satirinin
   * kullanici_id'si ve mevcut durumu -- "Kazandi olarak isaretle" butonu icin. */
  kullaniciId?: string;
  teklifDurumu?: "beklemede" | "kabul_edildi" | "reddedildi";
  /** Sunucu tarafinda hesaplanmis "bu satir kazandi mi" bayragi -- maskeli
   * tier'da kullanici_id hic donmedigi ve dosya turu tekliflerde tutar
   * eslesmesi calismadigi icin kazanan satiri boylece guvenle bulunur. */
  kazandiMi?: boolean;
  teklifTuru?: "nakit" | "dosya";
  teklifDosyasiPath?: string | null;
  alternatifProjePath?: string | null;
  /** Yalnizca ihale sahibi gorunumunde dolu -- "Bildir" akisi icin
   * teklifin kendi id'si ve dosya boyutu supheli mi bayraklari. */
  teklifId?: string;
  dosyaSuphesiMi?: boolean;
  altProjeSuphesiMi?: boolean;
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
  const tutarlar = firmalar.map((f) => f.tutar).filter((t): t is number => t !== null);
  if (tutarlar.length === 0) return null;
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

// Toplam ihale süresi uzatma sınırı (gün) — yalnızca Kurumsal plan bu
// eski (elapsed-day tavanlı) mekanizmayı kullanır. Ücretsiz planda
// uzatma hakkı hiç yok (0). Premium artık bu yolu kullanmaz — kendi
// dağıtılabilir "uzatma havuzu" ile, ihale detay sayfasındaki "Süre
// Ekle" bileşeninden (SureEkleKart) uzatılır; bu yüzden burada
// tanımlanmadı (undefined → bileşen "kilitli" gösterir).
export const PLAN_UZATMA_LIMITI: Partial<Record<PlanTuru, number>> = {
  ucretsiz: 0,
  kurumsal: PLAN_TOPLAM_MAKS_IHALE_GUNU.kurumsal,
};

export function gunFarki(baslangic: string, bitis: string): number {
  return Math.round((new Date(bitis).getTime() - new Date(baslangic).getTime()) / (1000 * 60 * 60 * 24));
}

export function tarihiGunEkleyerekUzat(tarih: string, eklenecekGun: number): string {
  const d = new Date(tarih);
  d.setDate(d.getDate() + eklenecekGun);
  return d.toISOString().split("T")[0];
}
