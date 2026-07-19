import type { PlanTuru } from "./types";

// Tek kaynak: plana göre izin verilen TOPLAM ihale süresi (gün).
// İlk oluşturmada seçilebilecek azami bitiş tarihi (ihale-olustur) ve
// "İhaleyi Uzat" özelliğinin toplam sınırı (ihale-sonuc) bu sabitten beslenir
// — ikisi farklı sayılar kullanırsa kullanıcı ilk oluşturmada zaten kendi
// planının toplam sınırını aşabilir.
export const PLAN_MAKS_IHALE_GUNU: Record<PlanTuru, number> = {
  ucretsiz: 5,
  premium: 45,
  kurumsal: 90,
};
