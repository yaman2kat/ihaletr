import type { IhaleDurumu } from "@/lib/types";

export function kalanGun(bitis: string) {
  const fark = new Date(bitis).getTime() - Date.now();
  return Math.max(0, Math.floor(fark / (1000 * 60 * 60 * 24)));
}

export function kalanSure(bitis: string): string {
  const fark = new Date(bitis).getTime() - Date.now();
  if (fark <= 0) return "Sona erdi";
  const gun = Math.floor(fark / (1000 * 60 * 60 * 24));
  const saat = Math.floor((fark % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (gun > 0) return `${gun} gün ${saat} saat`;
  return `${saat} saat`;
}

export function tarihFormat(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

export function paraBirim(tutar: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(tutar);
}

export function gunEkle(tarihIso: string, gun: number) {
  const d = new Date(tarihIso);
  d.setDate(d.getDate() + gun);
  return d.toISOString().slice(0, 10);
}

export const DURUM_BADGE: Record<IhaleDurumu, { etiket: string; cls: string }> = {
  aktif:       { etiket: "Aktif",       cls: "bg-green-100 text-green-700" },
  beklemede:   { etiket: "Beklemede",   cls: "bg-yellow-100 text-yellow-700" },
  tamamlandi:  { etiket: "Tamamlandı",  cls: "bg-gray-100 text-gray-600" },
  iptal:       { etiket: "İptal",       cls: "bg-red-100 text-red-600" },
};
