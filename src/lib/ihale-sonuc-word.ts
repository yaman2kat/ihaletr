import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, HeadingLevel, WidthType,
} from "docx";
import type { IhaleSonucVerisi } from "./ihale-sonuc";
import { ozetIstatistikHesapla, formatPara, formatTarih } from "./ihale-sonuc";

function hucre(metin: string, kalin = false): TableCell {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: metin, bold: kalin })] })],
  });
}

export async function ihaleSonucWordOlustur(veri: IhaleSonucVerisi): Promise<Blob> {
  const ozet = ozetIstatistikHesapla(veri.firmalar);
  const siraliFirmalar = [...veri.firmalar].sort((a, b) => a.tutar - b.tutar);

  const basliklar = new TableRow({
    children: [hucre("Firma", true), hucre("Teklif Tutarı", true), hucre("Ortalama Puan", true)],
  });

  const satirlar = siraliFirmalar.map((f) => new TableRow({
    children: [
      hucre(f.firmaAdi),
      hucre(formatPara(f.tutar)),
      hucre(f.ortalamaPuan !== null ? `${f.ortalamaPuan.toFixed(1)} (${f.yorumSayisi} yorum)` : "Henüz değerlendirme yok"),
    ],
  }));

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: "İhale Sonuç Raporu", heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: veri.ihaleBaslik, heading: HeadingLevel.HEADING_2 }),
          new Paragraph({ text: `Kurum: ${veri.kurum}` }),
          new Paragraph({ text: `İlan Tarihi: ${formatTarih(veri.baslangicTarihi)}` }),
          new Paragraph({ text: `Son Teklif Tarihi: ${formatTarih(veri.bitisTarihi)}` }),
          new Paragraph({ text: "" }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [basliklar, ...satirlar],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "Özet", heading: HeadingLevel.HEADING_2 }),
          ...(ozet
            ? [
                new Paragraph({ text: `En Yüksek Teklif: ${formatPara(ozet.enYuksek)}` }),
                new Paragraph({ text: `En Düşük Teklif: ${formatPara(ozet.enDusuk)}` }),
                new Paragraph({ text: `Ortalama Teklif: ${formatPara(Math.round(ozet.ortalama))}` }),
              ]
            : [new Paragraph({ text: "Teklif bulunmuyor." })]),
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}
