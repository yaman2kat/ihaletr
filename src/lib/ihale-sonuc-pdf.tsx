"use client";

import { Document, Page, Text, View, StyleSheet, Font, pdf } from "@react-pdf/renderer";
import type { IhaleSonucVerisi } from "./ihale-sonuc";
import { ozetIstatistikHesapla, formatPara, formatTarih } from "./ihale-sonuc";

let fontKayitliMi = false;

function fontlariKaydet() {
  if (fontKayitliMi) return;
  Font.register({
    family: "Noto Sans",
    fonts: [
      { src: "/fonts/NotoSans-Regular.ttf", fontWeight: "normal" },
      { src: "/fonts/NotoSans-Bold.ttf", fontWeight: "bold" },
    ],
  });
  fontKayitliMi = true;
}

const styles = StyleSheet.create({
  page: { fontFamily: "Noto Sans", fontSize: 10, lineHeight: 1.5, padding: 40, color: "#111827" },
  baslik: { fontSize: 16, fontWeight: "bold", marginBottom: 4 },
  altBaslik: { fontSize: 10, color: "#4b5563", marginBottom: 4 },
  bolumBaslik: { fontSize: 12, fontWeight: "bold", marginTop: 16, marginBottom: 8 },
  tabloBaslikSatiri: { flexDirection: "row", backgroundColor: "#eff6ff", paddingVertical: 6, paddingHorizontal: 4 },
  tabloSatiri: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb", paddingVertical: 6, paddingHorizontal: 4 },
  hFirma: { width: "40%", fontWeight: "bold" },
  hTutar: { width: "30%", fontWeight: "bold", textAlign: "right" },
  hPuan: { width: "30%", fontWeight: "bold", textAlign: "right" },
  cFirma: { width: "40%" },
  cTutar: { width: "30%", textAlign: "right" },
  cPuan: { width: "30%", textAlign: "right" },
  ozetSatiri: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
});

function IhaleSonucPdfBelgesi({ veri }: { veri: IhaleSonucVerisi }) {
  fontlariKaydet();
  const ozet = ozetIstatistikHesapla(veri.firmalar);
  const siraliFirmalar = [...veri.firmalar].sort((a, b) => a.tutar - b.tutar);

  return (
    <Document title={`${veri.ihaleBaslik} - Ihale Sonuc Raporu`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.baslik}>İhale Sonuç Raporu</Text>
        <Text style={styles.altBaslik}>{veri.ihaleBaslik} · {veri.kurum}</Text>
        <Text style={styles.altBaslik}>
          İlan: {formatTarih(veri.baslangicTarihi)}  ·  Son Teklif: {formatTarih(veri.bitisTarihi)}
        </Text>

        <Text style={styles.bolumBaslik}>Teklifler</Text>
        <View style={styles.tabloBaslikSatiri}>
          <Text style={styles.hFirma}>Firma</Text>
          <Text style={styles.hTutar}>Teklif Tutarı</Text>
          <Text style={styles.hPuan}>Ortalama Puan</Text>
        </View>
        {siraliFirmalar.map((f, i) => (
          <View key={i} style={styles.tabloSatiri}>
            <Text style={styles.cFirma}>{f.firmaAdi}</Text>
            <Text style={styles.cTutar}>{formatPara(f.tutar)}</Text>
            <Text style={styles.cPuan}>
              {f.ortalamaPuan !== null ? `${f.ortalamaPuan.toFixed(1)} (${f.yorumSayisi})` : "—"}
            </Text>
          </View>
        ))}

        <Text style={styles.bolumBaslik}>Özet</Text>
        {ozet ? (
          <>
            <View style={styles.ozetSatiri}><Text>En Yüksek Teklif</Text><Text>{formatPara(ozet.enYuksek)}</Text></View>
            <View style={styles.ozetSatiri}><Text>En Düşük Teklif</Text><Text>{formatPara(ozet.enDusuk)}</Text></View>
            <View style={styles.ozetSatiri}><Text>Ortalama Teklif</Text><Text>{formatPara(Math.round(ozet.ortalama))}</Text></View>
          </>
        ) : (
          <Text>Teklif bulunmuyor.</Text>
        )}
      </Page>
    </Document>
  );
}

export async function ihaleSonucPdfDosyasiOlustur(veri: IhaleSonucVerisi): Promise<Blob> {
  return pdf(<IhaleSonucPdfBelgesi veri={veri} />).toBlob();
}
