export type IhaleDurumu = "aktif" | "beklemede" | "tamamlandi" | "iptal";
export type KullaniciRol = "arsa_sahibi" | "muteahhit";
export type PlanTuru = "ucretsiz" | "premium" | "kurumsal";

// Panel görünümünü ve davet ödül otomasyonunu belirler; mevcut
// KullaniciRol/plan_turu alanlarından bağımsız, ayrı bir alandır.
export type HesapTuru = "arsa_sahibi" | "muteahhit" | "her_ikisi";

export type MulkiyetDurumu = "tek_malik" | "hisseli" | "vekaleten" | "sirket";
export type IncelemeDurumu = "beklemede" | "onaylandi" | "reddedildi";

// hesap_turu/rol'dan bağımsız, yeni bir alan — yalnızca bireysel/kurumsal
// kimlik doğrulama akışını (onboarding) belirler.
export type KisiTuru = "bireysel" | "kurumsal";
export type KimlikDogrulamaDurumu = "bekliyor" | "onaylandi" | "reddedildi";
export type OtomatikKontrolSonucu = "otomatik_onay_bekliyor" | "manuel_inceleme";

export interface KimlikDogrulamaBasvurusu {
  id: string;
  kullanici_id: string;
  kisi_turu: KisiTuru;
  ad_soyad?: string | null;
  firma_adi?: string | null;
  tc_kimlik_no?: string | null;
  vergi_no?: string | null;
  kimlik_on_url?: string | null;
  kimlik_arka_url?: string | null;
  selfie_url?: string | null;
  imza_sirkuleri_url?: string | null;
  ticaret_sicil_url?: string | null;
  otomatik_kontrol_sonucu: OtomatikKontrolSonucu;
  admin_karari: KimlikDogrulamaDurumu;
  red_notu?: string | null;
  created_at: string;
}
export type BelgeTuru =
  | "ruhsat" | "proje" | "sozlesme" | "denetim_raporu" | "fotograf" | "diger"
  | "tapu" | "vekaletname" | "imza_sirkuleri";

export interface Belge {
  id: string;
  baslik: string;
  dosya_url: string;
  dosya_tipi?: string | null;
  boyut?: number | null;
  /** Yalnizca tur='tapu' icin dolu -- SHA-256 hash, mukerrerlik kontrolu icin. */
  dosya_hash?: string | null;
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
  web_sitesi?: string;
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
  secilen_firma_id?: string | null;
  sure_gun?: number | null;
  yayinlanma_tarihi?: string | null;
  sonuc_aciklama_tarihi?: string | null;
  son_uyari_gonderildi?: string | null;
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
  kisi_turu?: KisiTuru | null;
  kimlik_dogrulama_durumu?: KimlikDogrulamaDurumu;
  kimlik_dogrulama_notu?: string | null;
  plan_turu?: PlanTuru;
  premium_bitis_tarihi?: string | null;
  kalan_teklif_hakki?: number;
  uzatma_havuzu_gun?: number;
  ucretsiz_ihale_hakki_kullanildi?: boolean;
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

export type TeklifTuru = "nakit" | "dosya";

export interface Teklif {
  id: string;
  ihale_id: string;
  kullanici_id: string;
  tutar: number | null;
  teklif_turu?: TeklifTuru;
  teklif_dosyasi_url?: string | null;
  alternatif_proje_url?: string | null;
  teklif_dosyasi_boyut?: number | null;
  alternatif_proje_boyut?: number | null;
  created_at: string;
}

export type TeklifBildirimSebebi = "dosya_bos" | "proje_ilgisiz" | "sartlar_eksik" | "sahte_kopya" | "diger";
export type TeklifBildirimDurumu = "beklemede" | "incelendi" | "ikaz_gonderildi";

export interface TeklifBildirimi {
  id: string;
  teklif_id: string;
  ihale_id: string;
  bildiren_id: string;
  sebep: TeklifBildirimSebebi;
  aciklama: string | null;
  durum: TeklifBildirimDurumu;
  admin_notu: string | null;
  ikaz_gonderildi: boolean;
  olusturulma_tarihi: string;
}

export interface DavetKullanimLogu {
  id: string;
  davet_eden_id: string;
  davet_edilen_id: string;
  aktivasyon_tarihi: string;
  aktivasyon_turu: "teklif" | "ihale";
  ay_yil: string;
}

export type BildirimTuru =
  | "yeni_teklif" | "ihale_onaylandi" | "ihale_reddedildi"
  | "ihale_otomatik_sonlandi" | "davet_odulu" | "odeme_sorunu" | "bolge_eslesmesi"
  | "ihale_kapatildi" | "ihale_kazanildi" | "ihale_kaybedildi" | "davet_limit_asildi" | "teklif_ikazi"
  | "sure_uyarisi";

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
