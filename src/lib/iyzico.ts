/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */

// iyzipay CJS modülüdür, resmi TypeScript tanımı yoktur
const Iyzipay = require("iyzipay");

export interface OdemeKart {
  kartSahibi: string;
  kartNo: string;
  sonAy: string;   // "01"–"12"
  sonYil: string;  // "2025"–"2035"
  cvv: string;
}

export interface OdemeIstek {
  paket: string;
  fiyat: string;       // "500.00" gibi
  aciklama: string;
  kart: OdemeKart;
  kullaniciId: string;
  email: string;
  adSoyad: string;
  telefon: string | null;
  ip: string;
}

export interface IyzicoCevap {
  status: "success" | "failure";
  errorCode?: string;
  errorMessage?: string;
  errorGroup?: string;
  paymentId?: string;
  price?: string;
  paidPrice?: string;
  conversationId?: string;
}

// "Ad Soyad" -> { ad, soyad }. Iyzico her ikisini de dolu ister; tek
// kelimelik isimlerde (soyadi bos) "-" ile doldurulur.
function isimSoyisimAyir(adSoyad: string): { ad: string; soyad: string } {
  const parcalar = adSoyad.trim().split(/\s+/).filter(Boolean);
  if (parcalar.length === 0) return { ad: "Musteri", soyad: "-" };
  if (parcalar.length === 1) return { ad: parcalar[0], soyad: "-" };
  return { ad: parcalar.slice(0, -1).join(" "), soyad: parcalar[parcalar.length - 1] };
}

// Kullanicinin kayitli telefonunu Iyzico'nun bekledigi "+90XXXXXXXXXX"
// formatina cevirir. Format geçersiz/eksikse (telefon hic girilmemis
// ya da beklenmeyen bir bicimde kaydedilmisse) sabit bir yer tutucuya
// duser -- Iyzico gsmNumber alani icin gecerli bir format ister,
// dogrulanamayan bir deger odemeyi tamamen reddettirebilir.
function telefonFormatla(telefon: string | null | undefined): string {
  const YER_TUTUCU = "+905000000000";
  if (!telefon) return YER_TUTUCU;
  const rakamlar = telefon.replace(/\D/g, "");
  let yerel = rakamlar;
  if (yerel.startsWith("90") && yerel.length === 12) yerel = yerel.slice(2);
  else if (yerel.startsWith("0")) yerel = yerel.slice(1);
  if (yerel.length !== 10) return YER_TUTUCU;
  return `+90${yerel}`;
}

function iyzipayClient() {
  return new Iyzipay({
    apiKey:    process.env.IYZICO_API_KEY    ?? "",
    secretKey: process.env.IYZICO_SECRET_KEY ?? "",
    uri:       process.env.IYZICO_BASE_URL   ?? "https://sandbox-api.iyzipay.com",
  });
}

export function odemeOlustur(istek: OdemeIstek): Promise<IyzicoCevap> {
  const client = iyzipayClient();
  const conversationId = `${istek.kullaniciId.slice(0, 8)}-${Date.now()}`;
  const { ad, soyad } = isimSoyisimAyir(istek.adSoyad);
  const gsmNumber = telefonFormatla(istek.telefon);

  const request = {
    locale:          "tr",
    conversationId,
    price:           istek.fiyat,
    paidPrice:       istek.fiyat,
    currency:        "TRY",
    installment:     "1",
    basketId:        conversationId,
    paymentChannel:  "WEB",
    paymentGroup:    "SUBSCRIPTION",
    paymentCard: {
      cardHolderName: istek.kart.kartSahibi,
      cardNumber:     istek.kart.kartNo.replace(/\s/g, ""),
      expireYear:     istek.kart.sonYil,
      expireMonth:    istek.kart.sonAy,
      cvc:            istek.kart.cvv,
      registerCard:   "0",
    },
    buyer: {
      id:                  istek.kullaniciId,
      name:                ad,
      surname:             soyad,
      gsmNumber,
      email:               istek.email,
      // Iyzico canlida musteri tipine gore TC kimlik no zorunlu degil;
      // uygulamada gercek TC kimlik no toplanmadigindan bos/placeholder
      // gonderilir (bkz. src/app/api/odeme/route.ts cagrisi).
      identityNumber:      "00000000000",
      lastLoginDate:       new Date().toISOString().replace("T", " ").slice(0, 19),
      registrationDate:    "2024-01-01 00:00:00",
      registrationAddress: "Türkiye",
      ip:                  istek.ip,
      city:                "Istanbul",
      country:             "Turkey",
      zipCode:             "34000",
    },
    shippingAddress: {
      contactName: istek.kart.kartSahibi,
      city:        "Istanbul",
      country:     "Turkey",
      address:     "Türkiye",
      zipCode:     "34000",
    },
    billingAddress: {
      contactName: istek.kart.kartSahibi,
      city:        "Istanbul",
      country:     "Turkey",
      address:     "Türkiye",
      zipCode:     "34000",
    },
    basketItems: [
      {
        id:        istek.paket,
        name:      istek.aciklama,
        category1: "Dijital Hizmet",
        itemType:  "VIRTUAL",
        price:     istek.fiyat,
      },
    ],
  };

  return new Promise((resolve, reject) => {
    client.payment.create(request, (err: Error | null, result: any) => {
      if (err) reject(err);
      else resolve(result as IyzicoCevap);
    });
  });
}
