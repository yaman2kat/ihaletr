import type { TeklifBildirimSebebi } from "./types";

// Hem ihale sahibinin "Bildir" modalindaki secenek listesi hem admin
// panelindeki etiketler/hazir ikaz metinleri bu tek kaynaktan beslenir.
export const SEBEP_ETIKETLERI: Record<TeklifBildirimSebebi, string> = {
  dosya_bos:      "Teklif dosyası boş veya anlamsız",
  proje_ilgisiz:  "Yüklenen proje ihaleyle ilgisiz",
  sartlar_eksik:  "Teklif şartları eksik/belirsiz",
  sahte_kopya:    "Sahte veya kopyalanmış içerik",
  diger:          "Diğer",
};

export const SEBEP_SIRASI: TeklifBildirimSebebi[] = [
  "dosya_bos", "proje_ilgisiz", "sartlar_eksik", "sahte_kopya", "diger",
];

// Admin, bildirilen bir teklifi incelerken sebebe gore hazir bir ikaz
// metni onerilir; gondermeden once serbestce duzenleyebilir.
export const IKAZ_METIN_SABLONLARI: Record<TeklifBildirimSebebi, (ihaleBaslik: string) => string> = {
  dosya_bos: (baslik) =>
    `Sayın yetkili, "${baslik}" numaralı ihaleye sunduğunuz teklif dosyasının içeriği yetersiz bulunmuştur. ` +
    `Platform kurallarına göre tekliflerin gerçek ve değerlendirilebilir içerik taşıması zorunludur. ` +
    `Tekrarı halinde hesabınıza yönelik kısıtlama uygulanabilir.`,
  proje_ilgisiz: (baslik) =>
    `Sayın yetkili, "${baslik}" numaralı ihaleye sunduğunuz proje dosyasının ihale konusuyla ilgisi bulunmadığı ` +
    `tespit edilmiştir. Yüklenen dosyaların ihale kapsamına uygun olması zorunludur. ` +
    `Tekrarı halinde hesabınıza yönelik kısıtlama uygulanabilir.`,
  sartlar_eksik: (baslik) =>
    `Sayın yetkili, "${baslik}" numaralı ihaleye sunduğunuz teklifte şartların (paylaşım oranı, süre, kapsam vb.) ` +
    `eksik veya belirsiz olduğu tespit edilmiştir. Tekliflerin tüm şartları açıkça belirtmesi zorunludur. ` +
    `Tekrarı halinde hesabınıza yönelik kısıtlama uygulanabilir.`,
  sahte_kopya: (baslik) =>
    `Sayın yetkili, "${baslik}" numaralı ihaleye sunduğunuz teklif dosyasının sahte ya da başka bir kaynaktan ` +
    `kopyalanmış olabileceği tespit edilmiştir. Bu durum platform kurallarının ciddi bir ihlalidir. ` +
    `Tekrarı halinde hesabınıza yönelik kısıtlama uygulanabilir.`,
  diger: (baslik) =>
    `Sayın yetkili, "${baslik}" numaralı ihaleye sunduğunuz teklif incelenmiş ve platform kurallarına aykırı ` +
    `bulunmuştur. Lütfen tekliflerinizin gerçek ve değerlendirilebilir içerik taşımasına dikkat ediniz. ` +
    `Tekrarı halinde hesabınıza yönelik kısıtlama uygulanabilir.`,
};
