export type IhaleDurumu = "aktif" | "beklemede" | "tamamlandi" | "iptal";
export type KullaniciRol = "arsa_sahibi" | "muteahhit";
export type PlanTuru = "ucretsiz" | "premium" | "kurumsal";

// Panel görünümünü ve davet ödül otomasyonunu belirler; mevcut
// KullaniciRol/plan_turu alanlarından bağımsız, ayrı bir alandır.
export type HesapTuru = "arsa_sahibi" | "muteahhit" | "her_ikisi";

export type MulkiyetDurumu = "tek_malik" | "hisseli" | "vekaleten" | "sirket";
export type IncelemeDurumu = "beklemede" | "onaylandi" | "reddedildi";
export type BelgeTuru =
  | "ruhsat" | "proje" | "sozlesme" | "denetim_raporu" | "fotograf" | "diger"
  | "tapu" | "vekaletname" | "imza_sirkuleri";

export interface Belge {
  id: string;
  baslik: string;
  dosya_url: string;
  dosya_tipi?: string | null;
  boyut?: number | null;
  tur: BelgeTuru;
  ihale_id?: string | null;
  danishman_id?: string | null;
  yukleyen_id?: string | null;
  created_at: string;
}

export type InsaatTuru = "Kentsel Dönüşüm" | "Kat Karşılığı" | "Yapı İnşaat" | "Bakım & Onarım";
export type YetkiBelgesiGrubu = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "Geçici/Y Belgesi";
export type InsaatAsamasi =
  | "Proje/Ruhsat"
  | "Temel"
  | "Kaba İnşaat"
  | "İnce İşler"
  | "Yapı Denetim/Teslim";

export interface Danishman {
  id: string;
  ad_soyad: string;
  uzmanlik_alanlari: InsaatTuru[];
  calistigi_iller: string[];
  il?: string;
  ilce?: string;
  telefon: string;
  email: string;
  deneyim_yili: number;
  biyografi: string;
  foto_url?: string;
  diploma_sertifika?: string;
  sertifika_url?: string;
  tamamlanan_proje_sayisi?: number;
  aktif_proje_sayisi?: number;
  meslek_odasi?: string;
  sicil_no?: string;
  created_at: string;
}

export interface DanishmanYorum {
  id: string;
  danishman_id: string;
  kullanici_id?: string;
  kullanici_adi: string;
  puan: number;
  yorum_metni: string;
  created_at: string;
}

export interface MuteahhitProfil {
  id: string;
  kullanici_id: string;
  firma_adi: string;
  kurulus_yili?: number;
  calistigi_iller: string[];
  uzmanlik_alanlari: InsaatTuru[];
  lisans_no?: string;
  sicil_no?: string;
  yetki_belgesi_grubu?: YetkiBelgesiGrubu;
  telefon?: string;
  email?: string;
  aciklama?: string;
  foto_url?: string;
  sertifika_bilgisi?: string;
  sertifika_url?: string;
  tamamlanan_proje_sayisi: number;
  kazanilan_ihale_sayisi: number;
  aktif_ihale_sayisi: number;
  created_at: string;
}

export interface ReferansProje {
  id: string;
  muteahhit_id: string;
  proje_adi: string;
  konum: string;
  yil: number;
  tur: InsaatTuru;
  fotograf_url?: string;
  aciklama?: string;
  created_at: string;
}

export interface MuteahhitYorum {
  id: string;
  muteahhit_id: string;
  kullanici_id?: string;
  kullanici_adi: string;
  puan: number;
  yorum_metni: string;
  created_at: string;
}

export interface Ihale {
  id: string;
  baslik: string;
  aciklama: string;
  kategori: string;
  baslangic_tarihi: string;
  bitis_tarihi: string;
  baslangic_fiyati: number;
  mevcut_teklif: number | null;
  durum: IhaleDurumu;
  kurum: string;
  sehir: string;
  ilce?: string;
  mahalle?: string;
  cadde_sokak?: string;
  ada_no?: string;
  parsel_no?: string;
  yapi_insaat_ruhsati?: "var" | "yok";
  proje?: "var" | "yok";
  goruntulenme_sayisi?: number;
  yuzolcumu_m2?: number;
  olusturan_id?: string | null;
  mulkiyet_durumu?: MulkiyetDurumu | null;
  basvuru_sahibi_adi?: string | null;
  sirket_unvani?: string | null;
  yetkili_kisi_adi?: string | null;
  inceleme_durumu?: IncelemeDurumu;
  red_sebebi?: string | null;
  otomatik_sonlandirildi?: boolean;
  created_at: string;
}

export interface Kullanici {
  id: string;
  email: string;
  ad_soyad: string;
  firma_adi: string | null;
  telefon: string | null;
  rol?: KullaniciRol;
  hesap_turu?: HesapTuru;
  plan_turu?: PlanTuru;
  premium_bitis_tarihi?: string | null;
  kalan_teklif_hakki?: number;
  toplam_teklif_sayisi?: number;
  davet_kodu?: string | null;
  davet_eden_id?: string | null;
  email_yeni_teklif?: boolean;
  email_ihale_durumu?: boolean;
  email_davet_odulu?: boolean;
  email_odeme_sorunu?: boolean;
  email_bolge_eslesmesi?: boolean;
  email_sure_uyarisi?: boolean;
  created_at: string;
}

export interface Teklif {
  id: string;
  ihale_id: string;
  kullanici_id: string;
  tutar: number;
  created_at: string;
}

export type OdulTuru = "teklif_hakki" | "sure_uzatma";

export interface Davet {
  id: string;
  davet_eden_id: string;
  davet_edilen_id: string;
  odul_verildi: boolean;
  odul_turu: OdulTuru | null;
  uygulanan_ihale_id: string | null;
  created_at: string;
  odul_verildi_tarihi: string | null;
  davet_edilen?: { ad_soyad: string };
}

export type BildirimTuru =
  | "yeni_teklif" | "ihale_onaylandi" | "ihale_reddedildi"
  | "ihale_otomatik_sonlandi" | "davet_odulu" | "odeme_sorunu" | "bolge_eslesmesi";

export interface Bildirim {
  id: string;
  kullanici_id: string;
  tur: BildirimTuru;
  baslik: string;
  mesaj: string;
  link: string | null;
  ihale_id: string | null;
  okundu: boolean;
  created_at: string;
}

export interface BildirimTercihleri {
  kullanici_id: string;
  yeni_teklif: boolean;
  ihale_durumu: boolean;
  davet_odulu: boolean;
  odeme_sorunu: boolean;
  bolge_eslesmesi: boolean;
  updated_at: string;
}
