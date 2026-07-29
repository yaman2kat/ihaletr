export type IhaleDurumu = "aktif" | "beklemede" | "tamamlandi" | "iptal";
export type KullaniciRol = "arsa_sahibi" | "muteahhit";
export type PlanTuru = "ucretsiz" | "premium" | "kurumsal";

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
  ada_no?: string;
  parsel_no?: string;
  yapi_insaat_ruhsati?: "var" | "yok";
  proje?: "var" | "yok";
  goruntulenme_sayisi?: number;
  yuzolcumu_m2?: number;
  olusturan_id?: string | null;
  created_at: string;
}

export interface Kullanici {
  id: string;
  email: string;
  ad_soyad: string;
  firma_adi: string | null;
  telefon: string | null;
  rol?: KullaniciRol;
  plan_turu?: PlanTuru;
  premium_bitis_tarihi?: string | null;
  kalan_teklif_hakki?: number;
  toplam_teklif_sayisi?: number;
  created_at: string;
}

export interface Teklif {
  id: string;
  ihale_id: string;
  kullanici_id: string;
  tutar: number;
  created_at: string;
}
