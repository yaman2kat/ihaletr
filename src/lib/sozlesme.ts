// Kat Karşılığı İnşaat Sözleşmesi — taslak metin üretici.
// Üretilen metin hukuki danışmanlık değildir; kullanıcı arayüzünde ve PDF çıktısında
// taslak uyarısı ayrıca gösterilir.

export interface ArsaSahibiBilgisi {
  adSoyad: string;
  tcKimlikNo: string;
  adres: string;
}

export interface MuteahhitBilgisi {
  unvanAdSoyad: string;
  tcVeyaVergiNo: string;
  adres: string;
}

export interface TasinmazBilgisi {
  il: string;
  ilce: string;
  mahalle: string;
  ada: string;
  parsel: string;
  m2: string;
  ihaleTuru: string;
}

export interface PaylasimOrani {
  arsaSahibiOrani: string;
  muteahhitOrani: string;
}

export interface SureVeCeza {
  ruhsatSuresiAy: string;
  insaatSuresiAy: string;
  gecikmeCezasiKatSayisi: string;
}

export interface TeknikKalem {
  anahtar: string;
  etiket: string;
  dahil: boolean;
  deger: string;
}

export interface SozlesmeFormVerisi {
  muteahhit: MuteahhitBilgisi;
  arsaSahipleri: ArsaSahibiBilgisi[];
  tasinmaz: TasinmazBilgisi;
  paylasim: PaylasimOrani;
  sure: SureVeCeza;
  teknikSartname: TeknikKalem[];
  yetkiliMahkemeIli: string;
}

export const VARSAYILAN_TEKNIK_SARTNAME: TeknikKalem[] = [
  { anahtar: "parke", etiket: "Zemin Kaplaması / Parke", dahil: true, deger: "Laminat parke, AC4 aşınma direnç sınıfı" },
  { anahtar: "mutfak", etiket: "Mutfak Dolabı", dahil: true, deger: "MDF lake mutfak dolabı, laminat tezgah üstü" },
  { anahtar: "cephe", etiket: "Cephe Kaplaması", dahil: true, deger: "Isı yalıtımlı (mantolama) dış cephe sistemi, silikon esaslı dış cephe boyası" },
  { anahtar: "asansor", etiket: "Asansör", dahil: true, deger: "Otis / Kone / Schindler dengi, TSE ve CE belgeli asansör" },
  { anahtar: "isitma", etiket: "Isıtma Sistemi", dahil: true, deger: "Doğalgaz kombili bireysel/merkezi ısıtma sistemi" },
  { anahtar: "pencere", etiket: "Pencere / Doğrama", dahil: true, deger: "PVC esaslı ısı yalıtımlı, çift camlı (ısıcam) doğrama" },
  { anahtar: "kapi", etiket: "Giriş Kapısı", dahil: true, deger: "Çelik kapı, çift çemberli, çok noktalı kilit sistemi" },
  { anahtar: "vitrifiye", etiket: "Banyo / Vitrifiye", dahil: true, deger: "Vitra / Creavit dengi vitrifiye ve armatür takımı" },
];

export function bosArsaSahibi(): ArsaSahibiBilgisi {
  return { adSoyad: "", tcKimlikNo: "", adres: "" };
}

export function bosSozlesmeVerisi(tasinmaz: TasinmazBilgisi): SozlesmeFormVerisi {
  return {
    muteahhit: { unvanAdSoyad: "", tcVeyaVergiNo: "", adres: "" },
    arsaSahipleri: [bosArsaSahibi()],
    tasinmaz,
    paylasim: { arsaSahibiOrani: "45", muteahhitOrani: "55" },
    sure: { ruhsatSuresiAy: "6", insaatSuresiAy: "18", gecikmeCezasiKatSayisi: "2" },
    teknikSartname: VARSAYILAN_TEKNIK_SARTNAME.map((k) => ({ ...k })),
    yetkiliMahkemeIli: tasinmaz.il,
  };
}

export interface SozlesmeBolum {
  baslik: string;
  paragraflar: string[];
}

export interface SozlesmeMetni {
  baslik: string;
  ustUyari: string;
  altUyari: string;
  bolumler: SozlesmeBolum[];
}

const TASLAK_UYARISI =
  "BU BELGE TASLAKTIR, HUKUKİ GEÇERLİLİK KAZANMASI İÇİN NOTER HUZURUNDA DÜZENLENMESİ GEREKİR";

function siraliListe(ogeler: string[]): string {
  return ogeler.map((o, i) => `${i + 1}. ${o}`).join("\n");
}

export function olusturSozlesmeMetni(v: SozlesmeFormVerisi, bugun = new Date()): SozlesmeMetni {
  const tarih = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" }).format(bugun);

  const arsaSahipleriListesi = v.arsaSahipleri
    .map((a, i) => `${i + 1}. ${a.adSoyad || "—"} (T.C. Kimlik No: ${a.tcKimlikNo || "—"}) — Adres: ${a.adres || "—"}`)
    .join("\n");

  const arsaSahipleriKisa = v.arsaSahipleri.map((a) => a.adSoyad || "—").join(", ");

  const secilenSartnameKalemleri = v.teknikSartname.filter((k) => k.dahil);

  const bolumler: SozlesmeBolum[] = [
    {
      baslik: "MADDE 1 — TARAFLAR",
      paragraflar: [
        `İşbu Kat Karşılığı İnşaat Sözleşmesi ("Sözleşme"), bir tarafta aşağıda kimlik ve adres bilgileri yazılı arsa sahibi/sahipleri ("ARSA SAHİBİ") ile diğer tarafta müteahhit ("MÜTEAHHİT") arasında, ${tarih} tarihinde, aşağıdaki şart ve koşullar dahilinde akdedilmiştir.`,
        `ARSA SAHİBİ/SAHİPLERİ:\n${arsaSahipleriListesi}`,
        `MÜTEAHHİT:\n${v.muteahhit.unvanAdSoyad || "—"} (T.C. Kimlik No / Vergi No: ${v.muteahhit.tcVeyaVergiNo || "—"}) — Adres: ${v.muteahhit.adres || "—"}`,
        "ARSA SAHİBİ ve MÜTEAHHİT, işbu Sözleşme'de birlikte \"Taraflar\", ayrı ayrı \"Taraf\" olarak anılacaktır.",
      ],
    },
    {
      baslik: "MADDE 2 — SÖZLEŞMENİN KONUSU",
      paragraflar: [
        `İşbu Sözleşme'nin konusu; aşağıda tapu ve konum bilgileri belirtilen taşınmaz üzerine, MÜTEAHHİT tarafından kendi nam ve hesabına, kat karşılığı inşaat yapılması ve inşaat sonucunda ortaya çıkacak bağımsız bölümlerin işbu Sözleşme'nin 5. maddesinde belirlenen paylaşım oranlarına göre Taraflar arasında paylaştırılmasıdır.`,
        `TAŞINMAZ BİLGİLERİ:\nİl: ${v.tasinmaz.il || "—"}\nİlçe: ${v.tasinmaz.ilce || "—"}\nMahalle: ${v.tasinmaz.mahalle || "—"}\nAda No: ${v.tasinmaz.ada || "—"}\nParsel No: ${v.tasinmaz.parsel || "—"}\nYüzölçümü: ${v.tasinmaz.m2 ? `${v.tasinmaz.m2} m²` : "—"}\nİhale Türü: ${v.tasinmaz.ihaleTuru || "—"}`,
      ],
    },
    {
      baslik: "MADDE 3 — İNŞAAT SÜRESİ VE TESLİM",
      paragraflar: [
        `MÜTEAHHİT, işbu Sözleşme'nin imza tarihinden itibaren en geç ${v.sure.ruhsatSuresiAy || "—"} ay içinde ilgili belediye/idareden yapı ruhsatını almakla yükümlüdür.`,
        `Yapı ruhsatının alınmasını müteakip inşaatın fiilen başlaması ve toplam inşaat süresinin en geç ${v.sure.insaatSuresiAy || "—"} ay içinde tamamlanarak yapı kullanma izin belgesi (iskân) alınmış şekilde ARSA SAHİBİ'ne teslim edilmesi zorunludur.`,
        "Teslim, taraflarca imzalanacak yazılı bir tutanak ile gerçekleştirilir. Tutanakta varsa eksiklikler ve giderilme süresi ayrıca belirtilir.",
      ],
    },
    {
      baslik: "MADDE 4 — DEVİR, PAYLAŞIM VE BEDEL",
      paragraflar: [
        `İnşaat sonucunda ortaya çıkacak bağımsız bölümler (daire, dükkan, otopark, depo vb.) Taraflar arasında; ARSA SAHİBİ'ne %${v.paylasim.arsaSahibiOrani || "—"}, MÜTEAHHİT'e %${v.paylasim.muteahhitOrani || "—"} oranında paylaştırılacaktır.`,
        "Paylaşıma konu bağımsız bölümlerin hangi bloklar/katlar/numaralar olduğu, kur'a veya Tarafların birlikte imzalayacağı ek bir paylaşım protokolü ile belirlenir ve bu protokol işbu Sözleşme'nin eki ve ayrılmaz parçası sayılır.",
        "Paylaşım oranına konu bağımsız bölümlerin tapuda devir ve tescil işlemleri, yapı kullanma izin belgesinin alınmasını takip eden makul süre içinde, Tarafların birlikte tapu müdürlüğüne başvurması suretiyle gerçekleştirilir. Devir işlemlerine ilişkin harç, vergi ve resmi giderler, aksi kararlaştırılmadıkça devri alan tarafça karşılanır.",
      ],
    },
    {
      baslik: "MADDE 5 — TARAFLARIN HAK VE YÜKÜMLÜLÜKLERİ",
      paragraflar: [
        "ARSA SAHİBİ, taşınmazın imar durumu ve tapu kayıtlarına ilişkin doğru beyanda bulunmayı, inşaatın yürütülmesi için gerekli izin, muvafakat ve vekaletnameleri zamanında vermeyi kabul ve taahhüt eder.",
        "MÜTEAHHİT; inşaatı iş bu Sözleşme'nin 6. maddesinde yer alan teknik şartnameye, yürürlükteki imar mevzuatına, deprem yönetmeliğine ve ilgili idarelerin ruhsat eki projelerine uygun olarak, iyi malzeme ve işçilik kullanarak yürütmeyi taahhüt eder.",
        "MÜTEAHHİT, inşaat süresince taşınmazda çalışacak tüm personelin iş sağlığı ve güvenliği mevzuatına uygun şekilde sigortalanmasından, üçüncü kişilere verilecek zararlardan ve inşaat alanı güvenliğinden münhasıran sorumludur.",
        "Taraflar, işbu Sözleşme kapsamındaki yükümlülüklerini iyiniyet ve dürüstlük kuralları çerçevesinde, karşılıklı iş birliği içinde yerine getirmeyi kabul eder.",
      ],
    },
    {
      baslik: "MADDE 6 — TEKNİK ŞARTNAME",
      paragraflar: [
        "İnşaatta kullanılacak asgari malzeme ve sistem standartları aşağıda belirtilmiş olup, MÜTEAHHİT bu standartlara denk veya üzerinde nitelikte malzeme kullanmakla yükümlüdür. Belirtilen marka/model isimleri asgari kalite referansı niteliğinde olup dengi ürünlerin kullanılması Tarafların yazılı mutabakatına tabidir.",
        secilenSartnameKalemleri.length > 0
          ? siraliListe(secilenSartnameKalemleri.map((k) => `${k.etiket}: ${k.deger || "—"}`))
          : "Taraflarca ayrıca teknik şartname kalemi belirlenmemiştir.",
      ],
    },
    {
      baslik: "MADDE 7 — CEZAİ ŞART",
      paragraflar: [
        `MÜTEAHHİT'in işbu Sözleşme'nin 3. maddesinde belirtilen inşaat süresini haklı bir mücbir sebep olmaksızın aşması halinde, gecikilen her ay için, taşınmazın bulunduğu bölgede emsal nitelikteki taşınmazların aylık rayiç kira bedelinin ${v.sure.gecikmeCezasiKatSayisi || "—"} katı tutarında gecikme cezasını ARSA SAHİBİ'ne/SAHİPLERİ'ne ödemeyi kabul ve taahhüt eder.`,
        "Gecikme cezasının uygulanması, ARSA SAHİBİ'nin işbu Sözleşme'den doğan diğer hak ve taleplerini (sözleşmenin feshi, tazminat vb.) ortadan kaldırmaz.",
        "Rayiç kira bedelinin tespitinde Taraflar anlaşamadığı takdirde, mahalli bilirkişi/emlak değerleme uzmanı raporu esas alınır.",
      ],
    },
    {
      baslik: "MADDE 8 — MÜCBİR SEBEPLER",
      paragraflar: [
        "Deprem, sel, yangın, salgın hastalık, savaş, terör olayları, genel seferberlik hali, resmi makamların idari kararları ve Tarafların makul kontrolü dışında gelişen ve öngörülemeyen benzeri haller mücbir sebep olarak kabul edilir.",
        "Mücbir sebep halinin belgelenmesi ve karşı tarafa gecikmeksizin yazılı olarak bildirilmesi kaydıyla, işbu Sözleşme'de öngörülen süreler, mücbir sebebin devam ettiği süre kadar uzar ve bu süre için cezai şart uygulanmaz.",
      ],
    },
    {
      baslik: "MADDE 9 — TEBLİGAT",
      paragraflar: [
        "Taraflar, işbu Sözleşme'de yazılı adreslerini tebligat adresi olarak kabul etmiş olup, adres değişikliklerinin karşı tarafa yazılı olarak (noter veya iadeli taahhütlü mektup ile) bildirilmesi zorunludur.",
        "Bildirilmeyen adres değişiklikleri halinde, Sözleşme'de yazılı son adrese yapılan tebligat geçerli ve tarafına yapılmış sayılır.",
      ],
    },
    {
      baslik: "MADDE 10 — UYUŞMAZLIKLARIN ÇÖZÜMÜ",
      paragraflar: [
        `İşbu Sözleşme'nin uygulanmasından doğabilecek her türlü uyuşmazlığın çözümünde ${v.yetkiliMahkemeIli || "—"} Mahkemeleri ve İcra Daireleri yetkilidir.`,
        "Taraflar, uyuşmazlık halinde öncelikle iyi niyetle ve karşılıklı görüşme yoluyla çözüm aramayı, bu yolla anlaşma sağlanamaması durumunda yukarıda belirtilen yargı yoluna başvurmayı kabul eder.",
      ],
    },
    {
      baslik: "MADDE 11 — SAİR HÜKÜMLER",
      paragraflar: [
        "İşbu Sözleşme'de hüküm bulunmayan hususlarda Türk Borçlar Kanunu, Türk Medeni Kanunu ve ilgili diğer mevzuat hükümleri uygulanır.",
        "İşbu Sözleşme'nin herhangi bir maddesinin geçersiz veya uygulanamaz sayılması, diğer maddelerin geçerliliğini etkilemez.",
        "İşbu Sözleşme'de yapılacak her türlü değişiklik ve ilave, Tarafların yazılı mutabakatı ile geçerlilik kazanır.",
        `İşbu Sözleşme, ${arsaSahipleriKisa || "—"} ve ${v.muteahhit.unvanAdSoyad || "—"} arasında, ${tarih} tarihinde, birer nüshası her bir Tarafta kalmak üzere düzenlenmiş ve okunarak taraflarca kabul edilmiştir.`,
      ],
    },
  ];

  return {
    baslik: "KAT KARŞILIĞI İNŞAAT SÖZLEŞMESİ",
    ustUyari: TASLAK_UYARISI,
    altUyari: TASLAK_UYARISI,
    bolumler,
  };
}

export function sozlesmeMetniDuzYazi(m: SozlesmeMetni): string {
  const parcalar: string[] = [m.ustUyari, "", m.baslik, ""];
  for (const b of m.bolumler) {
    parcalar.push(b.baslik);
    for (const p of b.paragraflar) parcalar.push(p);
    parcalar.push("");
  }
  parcalar.push(m.altUyari);
  return parcalar.join("\n\n");
}
