import OdemeFormu from "./OdemeFormu";

// IYZICO_BASE_URL sunucu-only bir degisken oldugu icin (NEXT_PUBLIC_
// degil) sandbox/canli ayrimi burada, sunucu tarafinda hesaplanip
// client bilesenine prop olarak gecilir -- src/lib/iyzico.ts'deki
// fallback ile ayni varsayilani kullanir.
export default async function OdemeSayfasi({ params }: { params: Promise<{ paket: string }> }) {
  const { paket } = await params;
  const baseUrl = process.env.IYZICO_BASE_URL ?? "https://sandbox-api.iyzipay.com";
  const sandboxMi = baseUrl.includes("sandbox");

  return <OdemeFormu paket={paket} sandboxMi={sandboxMi} />;
}
