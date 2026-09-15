// Teknik hata metinlerini (Supabase/Postgres hata kodları, İngilizce
// mesajlar, RLS/veritabanı hataları) kullanıcıya gösterilecek Türkçe,
// anlaşılır mesajlara çevirir. Uygulamaya özel hata kodları (ör.
// TEKLIF_HAKKI_YETERSIZ, UZATMA_HAVUZU_YETERSIZ) her zaman çağıran
// tarafta AYRICA ve ÖNCE kontrol edilmelidir -- bu fonksiyon yalnızca
// son çare (fallback) genel çeviri katmanıdır.
const DESEN_MESAJLARI: [RegExp, string][] = [
  [/row-level security policy/i, "Bu işlemi gerçekleştirme yetkiniz bulunmuyor."],
  [/invalid key/i, "Dosya adında geçersiz karakter var. Lütfen dosyayı yeniden adlandırıp deneyin."],
  [/jwt expired/i, "Oturumunuzun süresi doldu. Lütfen tekrar giriş yapın."],
  [/duplicate key/i, "Bu kayıt zaten mevcut."],
  [/foreign key constraint/i, "İlgili kayıt bulunamadı."],
  [/failed to fetch|networkerror|network error|fetch failed|econnrefused|etimedout|load failed/i,
    "Bağlantı hatası. Lütfen internet bağlantınızı kontrol edip tekrar deneyin."],
];

const GENEL_MESAJ = "Beklenmedik bir hata oluştu. Lütfen tekrar deneyin.";

function mesajCikar(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return "";
}

/**
 * Kullanıcıya gösterilecek Türkçe hata mesajını üretir. `ozelKodlar`
 * verilirse (ör. { TEKLIF_HAKKI_YETERSIZ: "..." }), ham mesaj bu
 * anahtarlardan birini içeriyorsa öncelikli olarak o mesaj döner.
 */
export function hataMesaji(err: unknown, ozelKodlar?: Record<string, string>): string {
  const ham = mesajCikar(err);
  if (!ham) return GENEL_MESAJ;

  if (ozelKodlar) {
    for (const [kod, mesaj] of Object.entries(ozelKodlar)) {
      if (ham.includes(kod)) return mesaj;
    }
  }

  for (const [desen, mesaj] of DESEN_MESAJLARI) {
    if (desen.test(ham)) return mesaj;
  }

  return GENEL_MESAJ;
}
