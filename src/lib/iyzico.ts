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
      name:                istek.email.split("@")[0],
      surname:             "Kullanici",
      gsmNumber:           "+905000000000",
      email:               istek.email,
      identityNumber:      "74300864791",
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
