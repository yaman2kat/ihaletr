"use client";

import { Document, Page, Text, View, StyleSheet, Font, pdf } from "@react-pdf/renderer";
import type { SozlesmeMetni } from "./sozlesme";

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
  page: {
    fontFamily: "Noto Sans",
    fontSize: 10,
    lineHeight: 1.5,
    padding: 48,
    color: "#111827",
  },
  uyari: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#b91c1c",
    textAlign: "center",
    marginBottom: 16,
  },
  baslik: {
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  bolumBaslik: {
    fontSize: 10.5,
    fontWeight: "bold",
    marginTop: 12,
    marginBottom: 6,
  },
  paragraf: {
    marginBottom: 6,
    textAlign: "justify",
  },
});

function SozlesmePdfBelgesi({ metin }: { metin: SozlesmeMetni }) {
  fontlariKaydet();
  return (
    <Document title={metin.baslik}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.uyari}>{metin.ustUyari}</Text>
        <Text style={styles.baslik}>{metin.baslik}</Text>
        {metin.bolumler.map((b) => (
          <View key={b.baslik} wrap>
            <Text style={styles.bolumBaslik}>{b.baslik}</Text>
            {b.paragraflar.map((p, i) => (
              <Text key={i} style={styles.paragraf}>{p}</Text>
            ))}
          </View>
        ))}
        <Text style={styles.uyari}>{metin.altUyari}</Text>
      </Page>
    </Document>
  );
}

export async function sozlesmePdfDosyasiOlustur(metin: SozlesmeMetni): Promise<File> {
  const blob = await pdf(<SozlesmePdfBelgesi metin={metin} />).toBlob();
  return new File([blob], "sozlesme-taslagi.pdf", { type: "application/pdf" });
}
