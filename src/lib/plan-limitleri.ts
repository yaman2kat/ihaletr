import type { PlanTuru } from "./types";

// Tek kaynak: plana göre izin verilen İLK (oluşturma anında seçilebilecek)
// ihale süresi (gün). "İhale Oluştur" formundaki azami bitiş tarihi ve
// panel'deki bilgi metni bu sabitten beslenir.
export const PLAN_ILK_IHALE_GUNU: Record<PlanTuru, number> = {
  ucretsiz: 5,
  premium: 45,
  kurumsal: 60,
};

// İlk süreye ek olarak "İhaleyi Uzat" ile eklenebilecek azami gün sayısı.
// Toplam azami ihale süresi PLAN_ILK_IHALE_GUNU + PLAN_EKSTRA_UZATMA_GUNU'dur
// (Premium: 45 + 15 = 60, Kurumsal: 60 + 30 = 90).
export const PLAN_EKSTRA_UZATMA_GUNU: Record<PlanTuru, number> = {
  ucretsiz: 0,
  premium: 15,
  kurumsal: 30,
};

export const PLAN_TOPLAM_MAKS_IHALE_GUNU: Record<PlanTuru, number> = {
  ucretsiz: PLAN_ILK_IHALE_GUNU.ucretsiz + PLAN_EKSTRA_UZATMA_GUNU.ucretsiz,
  premium: PLAN_ILK_IHALE_GUNU.premium + PLAN_EKSTRA_UZATMA_GUNU.premium,
  kurumsal: PLAN_ILK_IHALE_GUNU.kurumsal + PLAN_EKSTRA_UZATMA_GUNU.kurumsal,
};
