const TURKCE_KARAKTER_HARITASI: Record<string, string> = {
  ş: "s", Ş: "S", ı: "i", İ: "I", ğ: "g", Ğ: "G",
  ü: "u", Ü: "U", ö: "o", Ö: "O", ç: "c", Ç: "C",
};

// Supabase Storage obje anahtarları boşluk ve birçok özel/Türkçe karakteri
// kabul etmiyor ("Invalid key" hatası) -- dosya adı olduğu gibi (ör.
// "Sipariş Bilgileri.pdf") storage yoluna eklenirse yükleme başarısız
// oluyordu. Yükleme öncesinde her zaman bu fonksiyondan geçirilmeli;
// dosyanın kullanıcıya gösterilen adı (ör. belgeler.baslik) etkilenmez,
// yalnızca storage'daki teknik yol/anahtar temizlenir.
export function dosyaAdiTemizle(adOrijinal: string): string {
  const noktaIndex = adOrijinal.lastIndexOf(".");
  const govde = noktaIndex > 0 ? adOrijinal.slice(0, noktaIndex) : adOrijinal;
  const uzantiHam = noktaIndex > 0 ? adOrijinal.slice(noktaIndex + 1) : "";

  const cevrilmis = govde.replace(/[şŞıİğĞüÜöÖçÇ]/g, (h) => TURKCE_KARAKTER_HARITASI[h] ?? h);
  // Yukarıda karşılığı olmayan diğer tüm aksanlı/özel/boşluk karakterleri
  // (Türkçe dışı diakritikler dahil) tek bir tire ile değiştirilir.
  const govdeTemiz = cevrilmis
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");

  const uzanti = uzantiHam.replace(/[^a-zA-Z0-9]/g, "");

  return (govdeTemiz || "dosya") + (uzanti ? `.${uzanti}` : "");
}
