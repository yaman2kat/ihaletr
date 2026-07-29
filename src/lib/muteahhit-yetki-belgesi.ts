import type { YetkiBelgesiGrubu } from "./types";

// Çevre, Şehircilik ve İklim Değişikliği Bakanlığı — Yapı Müteahhitliği Yetki Belgesi grupları.
export const YETKI_BELGESI_GRUPLARI: YetkiBelgesiGrubu[] = [
  "A", "B", "C", "D", "E", "F", "G", "H", "Geçici/Y Belgesi",
];

// Gruplar, "Yapı Müteahhitlerinin Sınıflandırılması ve Kayıtlarının Tutulması
// Hakkında Yönetmelik" Madde 14 uyarınca sabit bir m² sınırıyla değil, Bakanlığın
// her yıl güncellediği referans "sınır bedeli" tutarının katları/oranlarına göre
// belirlenen iş deneyimi ve üstlenilebilecek azami iş bedeliyle sınırlandırılır.
// Bu yüzden tooltip'te sabit bir m² değeri yerine yönetmelikteki gerçek kriter özetlenir.
export const YETKI_BELGESI_ACIKLAMA: Record<YetkiBelgesiGrubu, string> = {
  A: "İş deneyim tutarı sınır bedelinin 2 katını aşar; üstlenebileceği iş bedelinde sınırlama yoktur.",
  B: "İş deneyim tutarı sınır bedelinin 7/5'ini aşar; üstlenebileceği azami iş bedeli sınır bedeli kadardır.",
  C: "İş deneyim tutarı sınır bedelini aşar; üstlenebileceği azami iş bedeli sınır bedeli kadardır.",
  D: "İş deneyim tutarı sınır bedelinin yaklaşık 1/2-2/3'ünü aşar; üstlenebileceği azami iş bedeli sınır bedeli kadardır.",
  E: "İş deneyim tutarı sınır bedelinin yaklaşık 1/5-1/3'ünü aşar; üstlenebileceği azami iş bedeli sınır bedelinin 1,15-1,33 katına kadardır.",
  F: "İş deneyim tutarı sınır bedelinin yaklaşık 1/10-17/200'ünü aşar; üstlenebileceği azami iş bedeli sınır bedelinin 1,75-2 katına kadardır.",
  G: "İş deneyim tutarı sınır bedelinin yaklaşık 1/20-7/100'ünü aşar; üstlenebileceği azami iş bedeli sınır bedelinin 1,5 katına kadardır.",
  H: "İş deneyimi aranmaz; üstlenebileceği azami iş bedeli G1 grubu bedelinin 5/7'si kadardır.",
  "Geçici/Y Belgesi": "Belirli bir işe özgü, tek kullanımlık yetki belgesidir; iş deneyimi veya ekipman şartı aranmaz.",
};
