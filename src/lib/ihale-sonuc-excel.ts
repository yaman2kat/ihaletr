import ExcelJS from "exceljs";
import type { IhaleSonucVerisi } from "./ihale-sonuc";
import { ozetIstatistikHesapla } from "./ihale-sonuc";

export async function ihaleSonucExcelOlustur(veri: IhaleSonucVerisi): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "İhaleTR";
  const sheet = workbook.addWorksheet("İhale Sonucu");

  sheet.columns = [
    { header: "Firma", key: "firma", width: 36 },
    { header: "Teklif Tutarı (₺)", key: "tutar", width: 20 },
    { header: "Ortalama Puan", key: "puan", width: 16 },
    { header: "Yorum Sayısı", key: "yorumSayisi", width: 14 },
  ];
  sheet.getRow(1).font = { bold: true };

  const siraliFirmalar = [...veri.firmalar].sort((a, b) => a.tutar - b.tutar);
  siraliFirmalar.forEach((f) => {
    sheet.addRow({
      firma: f.firmaAdi,
      tutar: f.tutar,
      puan: f.ortalamaPuan !== null ? Number(f.ortalamaPuan.toFixed(1)) : "—",
      yorumSayisi: f.yorumSayisi,
    });
  });

  sheet.getColumn("tutar").numFmt = "#,##0";

  const ozet = ozetIstatistikHesapla(veri.firmalar);
  if (ozet) {
    sheet.addRow({});
    const enYuksekRow = sheet.addRow({ firma: "En Yüksek Teklif", tutar: ozet.enYuksek });
    const enDusukRow  = sheet.addRow({ firma: "En Düşük Teklif",  tutar: ozet.enDusuk  });
    const ortalamaRow = sheet.addRow({ firma: "Ortalama Teklif",  tutar: Math.round(ozet.ortalama) });
    [enYuksekRow, enDusukRow, ortalamaRow].forEach((row) => {
      row.getCell("firma").font = { bold: true };
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
