// Örnek yapı şartnamesi Word şablonlarını (docx) üretir ve Supabase
// Storage'daki "sartname-sablonlari" public bucket'ına yükler.
// Çalıştırmadan önce supabase/sartname_sablonlari_bucket_migration.sql
// dosyasının Supabase SQL editöründe çalıştırılmış olması gerekir.
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle,
} from "docx";
import { SABLONLAR } from "./sartname-sablonlari-icerik.mjs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const YAZI_TIPI = "Calibri";

function imzaTablosu() {
  const hucre = (metin) => new TableCell({
    borders: {
      top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
    },
    children: [
      new Paragraph({ spacing: { before: 400 }, children: [new TextRun({ text: metin, bold: true, font: YAZI_TIPI })] }),
      new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: "Ad Soyad / Unvan: [...]", font: YAZI_TIPI })] }),
      new Paragraph({ children: [new TextRun({ text: "Tarih: [.../.../......]", font: YAZI_TIPI })] }),
      new Paragraph({ spacing: { before: 400 }, children: [new TextRun({ text: "İmza: ________________________", font: YAZI_TIPI })] }),
    ],
    width: { size: 50, type: WidthType.PERCENTAGE },
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE },
    },
    rows: [new TableRow({ children: [hucre("TARAF 1"), hucre("TARAF 2")] })],
  });
}

function belgeOlustur(sablon) {
  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "İhaleTR — Örnek Şartname", bold: true, color: "2563EB", font: YAZI_TIPI, size: 20 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 80 },
      children: [new TextRun({ text: sablon.baslik, font: YAZI_TIPI })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: sablon.altBaslik, italics: true, color: "6B7280", font: YAZI_TIPI, size: 20 })],
    }),
    new Paragraph({
      shading: { fill: "FEF3C7" },
      spacing: { after: 300 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 4, color: "F59E0B" },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: "F59E0B" },
        left: { style: BorderStyle.SINGLE, size: 4, color: "F59E0B" },
        right: { style: BorderStyle.SINGLE, size: 4, color: "F59E0B" },
      },
      children: [new TextRun({
        text: "UYARI: Bu belge yalnızca bilgilendirme ve örnek oluşturma amaçlıdır; hukuki danışmanlık yerine geçmez. Köşeli parantez içindeki [...] alanlar tarafların somut durumuna göre doldurulmalı, imzalanmadan önce mutlaka bir avukata ve/veya mali müşavire danışılmalıdır.",
        italics: true, font: YAZI_TIPI, size: 18,
      })],
    }),
  ];

  for (const madde of sablon.maddeler) {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 120 },
      children: [new TextRun({ text: madde.baslik, font: YAZI_TIPI, color: "1D4ED8" })],
    }));
    for (const p of madde.paragraflar) {
      children.push(new Paragraph({
        spacing: { after: 120 },
        alignment: AlignmentType.JUSTIFIED,
        children: [new TextRun({ text: p, font: YAZI_TIPI, size: 21 })],
      }));
    }
  }

  children.push(new Paragraph({ spacing: { before: 400 }, children: [] }));
  children.push(imzaTablosu());

  return new Document({
    creator: "İhaleTR",
    title: sablon.baslik,
    sections: [{
      properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } },
      children,
    }],
  });
}

mkdirSync("sartname-sablonlari-ciktilar", { recursive: true });

const BUCKET = "sartname-sablonlari";

// supabase/sartname_sablonlari_bucket_migration.sql henuz calistirilmamis
// olabilir -- bucket yoksa burada da olusturulur (idempotent: "already
// exists" hatasi yoksayilir).
const { error: bucketError } = await supabase.storage.createBucket(BUCKET, { public: true });
if (bucketError && !/already exists/i.test(bucketError.message)) {
  throw bucketError;
}

for (const key of Object.keys(SABLONLAR)) {
  const sablon = SABLONLAR[key];
  const doc = belgeOlustur(sablon);
  const buffer = await Packer.toBuffer(doc);

  const yerelYol = `sartname-sablonlari-ciktilar/${sablon.dosyaAdi}`;
  writeFileSync(yerelYol, buffer);
  console.log(`Oluşturuldu: ${yerelYol} (${(buffer.length / 1024).toFixed(0)} KB)`);

  const { error } = await supabase.storage.from(BUCKET).upload(sablon.dosyaAdi, buffer, {
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    upsert: true,
  });

  if (error) {
    console.error(`YÜKLEME HATASI (${sablon.dosyaAdi}):`, error.message);
  } else {
    console.log(`Yüklendi -> ${BUCKET}/${sablon.dosyaAdi}`);
  }
}

console.log("Tamamlandı.");
