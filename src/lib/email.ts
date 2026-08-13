import { Resend } from "resend";

// Tek sefer olusturulur; RESEND_API_KEY yoksa (ör. lokal test) gonderim
// sessizce atlanir, uygulama akisini bozmaz.
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const GONDEREN = "İhaleTR <onboarding@resend.dev>";

function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function formatPara(tutar: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency", currency: "TRY", minimumFractionDigits: 0,
  }).format(tutar);
}

// Ortak marka sablonu: tum bildirim e-postalari bu govdeyi kullanir.
function sablon(opts: { baslik: string; govdeHtml: string; ctaMetin?: string; ctaLink?: string }): string {
  const { baslik, govdeHtml, ctaMetin, ctaLink } = opts;
  const url = siteUrl();
  return `<!doctype html>
<html lang="tr">
  <body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="background-color:#1d4ed8;padding:24px 32px;">
                <span style="color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:-0.02em;">İhaleTR</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px;font-size:18px;color:#111827;">${baslik}</h1>
                <div style="font-size:14px;line-height:1.6;color:#374151;">${govdeHtml}</div>
                ${ctaMetin && ctaLink ? `
                <div style="margin-top:28px;">
                  <a href="${ctaLink}" style="display:inline-block;background-color:#1d4ed8;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:10px;">${ctaMetin}</a>
                </div>` : ""}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background-color:#f9fafb;border-top:1px solid #f1f5f9;">
                <p style="margin:0;font-size:12px;color:#9ca3af;">
                  Bu e-postayı İhaleTR hesabınızdaki bir işlem nedeniyle aldınız.
                  E-posta bildirim tercihlerinizi
                  <a href="${url}/panel/bildirim-ayarlari" style="color:#1d4ed8;">bildirim ayarları</a>
                  sayfasından değiştirebilirsiniz.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function gonder(to: string, subject: string, html: string): Promise<void> {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY tanımlı değil, gönderim atlandı:", subject, "->", to);
    return;
  }
  try {
    const { error } = await resend.emails.send({ from: GONDEREN, to, subject, html });
    if (error) console.error("[email] Resend hatası:", subject, "->", to, error);
  } catch (err) {
    console.error("[email] Gönderim istisnası:", subject, "->", to, err);
  }
}

// 1) Yeni teklif alındı (ihale sahibine)
export async function gonderYeniTeklifEmaili(opts: {
  to: string; adSoyad: string; ihaleBaslik: string; ihaleId: string; tutar: number;
}) {
  const html = sablon({
    baslik: "Yeni bir teklif alındı",
    govdeHtml: `
      <p>Merhaba ${opts.adSoyad},</p>
      <p><strong>${opts.ihaleBaslik}</strong> başlıklı ihalenize <strong>${formatPara(opts.tutar)}</strong> tutarında yeni bir teklif verildi.</p>`,
    ctaMetin: "Teklifi Görüntüle",
    ctaLink: `${siteUrl()}/ihaleler/${opts.ihaleId}`,
  });
  await gonder(opts.to, `Yeni teklif alındı — ${opts.ihaleBaslik}`, html);
}

// 2) İhale onaylandı (ihale sahibine)
export async function gonderIhaleOnaylandiEmaili(opts: {
  to: string; adSoyad: string; ihaleBaslik: string; ihaleId: string;
}) {
  const html = sablon({
    baslik: "İhaleniz onaylandı",
    govdeHtml: `
      <p>Merhaba ${opts.adSoyad},</p>
      <p><strong>${opts.ihaleBaslik}</strong> ihaleniz mülkiyet incelemesinden onaylandı ve artık yayında.</p>`,
    ctaMetin: "İhaleyi Görüntüle",
    ctaLink: `${siteUrl()}/ihaleler/${opts.ihaleId}`,
  });
  await gonder(opts.to, `İhaleniz onaylandı — ${opts.ihaleBaslik}`, html);
}

// 3) İhale reddedildi (ihale sahibine)
export async function gonderIhaleReddedildiEmaili(opts: {
  to: string; adSoyad: string; ihaleBaslik: string; redSebebi: string;
}) {
  const html = sablon({
    baslik: "İhaleniz reddedildi",
    govdeHtml: `
      <p>Merhaba ${opts.adSoyad},</p>
      <p><strong>${opts.ihaleBaslik}</strong> ihaleniz incelemeden reddedildi.</p>
      <p style="background-color:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px 16px;color:#b91c1c;">${opts.redSebebi}</p>`,
    ctaMetin: "Panele Git",
    ctaLink: `${siteUrl()}/panel`,
  });
  await gonder(opts.to, `İhaleniz reddedildi — ${opts.ihaleBaslik}`, html);
}

// 4) Davet ödülü uygulandı (davet edene)
export async function gonderDavetOduluEmaili(opts: {
  to: string; adSoyad: string; odulTuru: "teklif_hakki" | "sure_uzatma"; ihaleBaslik?: string;
}) {
  const aciklama = opts.odulTuru === "teklif_hakki"
    ? "Davetiniz kabul edildi ve +1 teklif hakkı kazandınız."
    : `Davetiniz kabul edildi${opts.ihaleBaslik ? `, "${opts.ihaleBaslik}" ihalenizin` : " ve bir ihalenizin"} süresi 15 gün uzatıldı.`;
  const html = sablon({
    baslik: "Davet ödülünüz uygulandı",
    govdeHtml: `<p>Merhaba ${opts.adSoyad},</p><p>${aciklama}</p>`,
    ctaMetin: "Panele Git",
    ctaLink: `${siteUrl()}/panel`,
  });
  await gonder(opts.to, "Davet ödülünüz uygulandı 🎉", html);
}

// 5) Bölge eşleşmesi (çalıştığı ilde yeni ihale — müteahhide)
export async function gonderBolgeEslesmesiEmaili(opts: {
  to: string; adSoyad: string; sehir: string; ilce?: string | null; ihaleBaslik: string; ihaleId: string;
}) {
  const bolge = opts.ilce ? `${opts.sehir} / ${opts.ilce}` : opts.sehir;
  const html = sablon({
    baslik: "Bölgenizde yeni bir ihale var",
    govdeHtml: `
      <p>Merhaba ${opts.adSoyad},</p>
      <p><strong>${bolge}</strong> bölgesinde <strong>${opts.ihaleBaslik}</strong> başlıklı yeni bir ihale yayınlandı.</p>`,
    ctaMetin: "İhaleyi Görüntüle",
    ctaLink: `${siteUrl()}/ihaleler/${opts.ihaleId}`,
  });
  await gonder(opts.to, `Bölgenizde yeni bir ihale var — ${bolge}`, html);
}

// 6) Süre dolmadan 48 saat önce uyarı (ihale sahibine)
export async function gonderSureUyarisiEmaili(opts: {
  to: string; adSoyad: string; ihaleBaslik: string; ihaleId: string;
}) {
  const html = sablon({
    baslik: "İhalenizin süresi dolmak üzere",
    govdeHtml: `
      <p>Merhaba ${opts.adSoyad},</p>
      <p><strong>${opts.ihaleBaslik}</strong> ihalenizin son teklif tarihine 48 saatten az kaldı. Gelen teklifleri incelemek için ihalenizi ziyaret edebilirsiniz.</p>`,
    ctaMetin: "İhaleyi Görüntüle",
    ctaLink: `${siteUrl()}/ihaleler/${opts.ihaleId}`,
  });
  await gonder(opts.to, `Süre dolmak üzere — ${opts.ihaleBaslik}`, html);
}
