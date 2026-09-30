// İhaleTR — örnek yapı şartnamesi şablonlarının metin içeriği.
// Her kategori için: başlık, taraflar/taşınmaz bilgi alanları ve
// numaralı maddeler. Kişiden kişiye değişen kısımlar [...] ile
// boş bırakılmıştır. Bu şablonlar bilgilendirme amaçlıdır, hukuki
// danışmanlık yerine geçmez.

const UYUSMAZLIK_MADDESI = (baslikNo) => ({
  baslik: `MADDE ${baslikNo} – UYUŞMAZLIKLARIN ÇÖZÜMÜ`,
  paragraflar: [
    "İşbu Şartname'nin uygulanmasından doğabilecek her türlü uyuşmazlığın çözümünde öncelikle taraflar iyi niyetle ve doğrudan görüşme yoluyla anlaşmaya çalışır.",
    "Doğrudan görüşme ile çözülemeyen uyuşmazlıklarda, dava şartı olarak, 6325 sayılı Hukuk Uyuşmazlıklarında Arabuluculuk Kanunu uyarınca arabulucuya başvurulması zorunludur.",
    "Arabuluculuk sürecinden sonuç alınamaması hâlinde uyuşmazlığın çözümünde [...] İl(i) Mahkemeleri ve İcra Daireleri yetkilidir.",
    "Taraflar, işbu Şartname kapsamındaki tüm tebligatların Madde 1'de belirtilen adreslerine yapılacağını, adres değişikliğinin karşı tarafa yazılı olarak (noter/iadeli taahhütlü posta/KEP) bildirilmediği sürece bu adreslere yapılan tebligatların geçerli sayılacağını kabul eder.",
  ],
});

const MUCBIR_SEBEP_MADDESI = (baslikNo) => ({
  baslik: `MADDE ${baslikNo} – MÜCBİR SEBEP`,
  paragraflar: [
    "Deprem, sel, yangın, salgın hastalık, savaş, genel seferberlik, terör olayları, resmi makamların iş durdurma kararı ve tarafların makul kontrolü dışında gelişen, önceden öngörülemeyen ve önlenemeyen benzer haller mücbir sebep sayılır.",
    "Mücbir sebep hâlinin ortaya çıkması durumunda, bu hâli ileri süren taraf durumu en geç [...] (….) iş günü içinde karşı tarafa yazılı olarak bildirmek ve belgelendirmekle yükümlüdür; aksi hâlde mücbir sebebe dayanamaz.",
    "Mücbir sebebin devam ettiği süre boyunca, bu süreyle sınırlı olmak kaydıyla, Madde 4'te belirlenen iş süresi ve takvim kendiliğinden uzar; taraflar bu süre için birbirlerinden gecikme tazminatı veya cezai şart talep edemez.",
  ],
});

const FESIH_MADDESI = (baslikNo, ekHukumler = []) => ({
  baslik: `MADDE ${baslikNo} – SÖZLEŞMENİN FESHİ`,
  paragraflar: [
    "Taraflardan birinin işbu Şartname'den ve eki sözleşmeden doğan yükümlülüklerini, karşı tarafın yazılı ihtarına rağmen ihtarda belirtilen makul süre (en az 15 gün) içinde yerine getirmemesi hâlinde, ihtarı gönderen taraf sözleşmeyi tek taraflı olarak feshedebilir.",
    "Yüklenici/Müteahhidin iflası, konkordato ilan etmesi, faaliyetlerini durdurması veya iş bu Şartname konusu işi devam ettiremeyecek şekilde mali/hukuki güçlük içine girmesi hâllerinde İşveren/Arsa Sahibi sözleşmeyi derhal feshedebilir.",
    ...ekHukumler,
    "Fesih hâlinde, fesih tarihine kadar usulüne uygun tamamlanmış ve kabul edilmiş imalatların bedeli/payı, işbu Şartname'nin ilgili ödeme/paylaşım maddesi hükümlerine göre hesaplanır; haksız fesheden taraf doğan zarar ve ziyandan sorumludur.",
  ],
});

const DENETIM_KABUL_MADDESI = (baslikNo, garantiYili = "2") => ({
  baslik: `MADDE ${baslikNo} – DENETİM VE KABUL`,
  paragraflar: [
    "İşveren/Arsa Sahibi veya yetkilendireceği teknik danışman/yapı denetim kuruluşu, işin her aşamasında imalatı denetleme ve Madde 3'teki standartlara aykırılık tespit ettiğinde düzeltilmesini yazılı olarak talep etme hakkına sahiptir.",
    "İmalatı ilgili mevzuat uyarınca denetlemekle yükümlü Yapı Denetim Kuruluşu'nun ara/final raporları ve resmi kabul tutanakları işbu Şartname'nin ayrılmaz ekidir.",
    "İşin fiilen tamamlanmasını müteakip 7 (yedi) iş günü içinde taraflar ve varsa yapı denetim görevlisi katılımıyla GEÇİCİ KABUL tutanağı düzenlenir; tespit edilen eksiklik ve kusurlar için Yüklenici/Müteahhide en fazla 30 (otuz) günlük düzeltme süresi verilir.",
    `Eksikliklerin giderilmesinin ardından KESİN KABUL yapılır. Kesin kabul tarihinden itibaren ${garantiYili} (${garantiYili === "2" ? "iki" : garantiYili}) yıl süreyle Yüklenici/Müteahhit, işçilik ve imalat kaynaklı gizli ayıplardan (malzeme üretim hatası kaynaklı ayıplar hariç, ilgili üretici garantisi geçerlidir) sorumludur.`,
    "Kesin kabulden sonra ortaya çıkan ve taşıyıcı sisteme ilişkin ayıplarda, Türk Borçlar Kanunu'nun eser sözleşmesine ve yapı kullanma/iskân mevzuatına ilişkin emredici hükümleri (ayıba karşı tekeffül dâhil) saklıdır.",
  ],
});

const CEZAI_SART_MADDESI = (baslikNo) => ({
  baslik: `MADDE ${baslikNo} – GECİKME VE CEZAİ ŞART`,
  paragraflar: [
    "İşin, Madde 4'te belirlenen süre içinde İşveren/Arsa Sahibinden kaynaklanmayan bir sebeple tamamlanmaması hâlinde, Yüklenici/Müteahhit her gecikme günü için [...] TL (veya sözleşme bedelinin binde [...]'i) oranında gecikme cezasını İşverene/Arsa Sahibine ödemeyi kabul eder.",
    "Toplam gecikme cezası, işbu Şartname'nin Madde [...]'inde belirtilen bedelin/payın %[...]'unu aşamaz; bu tavana ulaşılması İşverene/Arsa Sahibine sözleşmeyi feshetme hakkı da tanır.",
    "Mücbir sebep hâlleri ile İşveren/Arsa Sahibinden veya resmi makamlardan (ruhsat/onay gecikmesi vb.) kaynaklanan gecikmeler cezai şart hesabına dâhil edilmez.",
  ],
});

export const SABLONLAR = {
  "bakim-onarim": {
    dosyaAdi: "bakim-onarim.docx",
    kategori: "Bakım & Onarım",
    baslik: "BAKIM VE ONARIM İŞLERİ ÖRNEK ŞARTNAMESİ",
    altBaslik: "(Mevcut Yapıda Bakım, Tadilat ve Onarım İşleri İçin Örnek Teknik ve Hukuki Şartname)",
    maddeler: [
      {
        baslik: "MADDE 1 – TARAFLAR VE TAŞINMAZ BİLGİLERİ",
        paragraflar: [
          "İŞVEREN: [Ad Soyad / Unvan], T.C. Kimlik No / Vergi No: [...], Adres: [...], Telefon: [...], E-posta: [...].",
          "YÜKLENİCİ (MÜTEAHHİT): [Ad Soyad / Firma Unvanı], Vergi No / Ticaret Sicil No: [...], Yetki Belgesi Grubu: [...], Adres: [...], Telefon: [...], E-posta: [...].",
          "TAŞINMAZIN ADRESİ: İl/İlçe: [...], Mahalle/Cadde/Sokak: [...], Ada/Parsel No: [...] / [...], Bağımsız Bölüm/Kapı No: [...].",
          "Taraflar yukarıda kimlik ve iletişim bilgileri belirtilen gerçek/tüzel kişiler olup, işbu Şartname'de sırasıyla \"İşveren\" ve \"Yüklenici\" olarak anılacaktır.",
        ],
      },
      {
        baslik: "MADDE 2 – İŞİN TANIMI VE KAPSAMI",
        paragraflar: [
          "İşbu Şartname, Madde 1'de tanımlanan taşınmazda yapılacak bakım, tadilat ve/veya onarım işlerinin teknik ve hukuki şartlarını düzenler. İşin kapsamı aşağıdaki gibidir (uygulanmayacak kalemler çizilir/boş bırakılır):",
          "a) Cephe/dış cephe kaplaması ve boya işleri: [...]",
          "b) Çatı ve teras su yalıtımı/onarımı: [...]",
          "c) Elektrik tesisatı bakım/yenileme: [...]",
          "d) Sıhhi tesisat ve doğalgaz tesisatı bakım/yenileme: [...]",
          "e) Asansör bakım/revizyon: [...]",
          "f) İç mekân (boya, alçı, zemin kaplaması vb.) tadilat işleri: [...]",
          "g) Yapısal güçlendirme / kısmi onarım: [...]",
          "h) Diğer: [...]",
          "İşin toplam keşif bedeli [...] TL (KDV [Dahil/Hariç]) olarak taraflarca kabul edilmiştir. Keşif listesi/metraj cetveli işbu Şartname'nin Ek-1'idir.",
          "İş kapsamına dâhil olmayan, sonradan talep edilecek ilave iş ve metraj artışları ancak tarafların yazılı mutabakatıyla ve ek keşif/fiyat farkı protokolüyle yapılabilir.",
        ],
      },
      {
        baslik: "MADDE 3 – TARAFLARIN YÜKÜMLÜLÜKLERİ",
        paragraflar: [
          "İşveren'in Yükümlülükleri: Taşınmaza ve ortak alanlara erişimi sağlamak; gerekli ise kat malikleri kurulu/yönetim izinlerini işin başlangıcından önce temin etmek; Madde 5'te belirlenen ödemeleri zamanında yapmak; işin yürütülmesi için gerekli su/elektrik erişimini makul ölçüde sağlamak.",
          "Yüklenici'nin Yükümlülükleri: İşi işçilik ve malzeme açısından Madde 4'teki standartlara, yürürlükteki imar, yapı ve iş sağlığı-güvenliği mevzuatına (6331 sayılı Kanun dâhil) uygun biçimde yürütmek; çalışanlarının SGK bildirimlerini ve iş güvenliği tedbirlerini (iskele, baret, bariyer vb.) eksiksiz almak; komşu bağımsız bölümlere ve ortak alanlara zarar vermemek, verdiği zararı bedelsiz gidermek; iş yerinde oluşan inşaat atığını/molozu yönetmelik gereğince ilgili lisanslı tesise taşıtmak; Madde 6'daki denetimlere imkân tanımak; ihtiyaç hâlinde asansör, iskele vb. için gerekli ruhsat/bildirimleri kendi sorumluluğunda almak.",
          "Yüklenici, işi bizzat veya nitelikli bir alt yüklenici eliyle yürütür; alt yüklenici kullanımı Yüklenicinin İşverene karşı sorumluluğunu ortadan kaldırmaz.",
        ],
      },
      {
        baslik: "MADDE 4 – MALZEME VE İŞÇİLİK STANDARTLARI",
        paragraflar: [
          "Kullanılacak tüm malzemeler TSE/TS EN standartlarına uygun, ilgili ürünlerde CE işaretli ve orijinal ambalajında olmalıdır; İşveren talep ettiğinde malzeme menşei/garanti belgeleri ibraz edilir.",
          "Su yalıtımı TS 11758 ve ilgili yalıtım standartlarına, elektrik tesisatı TS HD 60364 serisine, sıhhi tesisat ilgili TS EN 12056/806 standartlarına uygun yapılır.",
          "Marka/model bazında malzeme seçimi Ek-1 keşif listesinde belirtilir; listede yer almayan kalemlerde İşveren'in önceden yazılı onayı alınmadan muadil/alternatif malzeme kullanılamaz.",
          "Tüm işçilik, ilgili meslek dalında yeterlilik/usta belgesine sahip personel tarafından, iyi uygulama (good workmanship) esasına göre yürütülür.",
        ],
      },
      {
        baslik: "MADDE 5 – İŞ SÜRESİ VE TAKVİM",
        paragraflar: [
          "İşe başlama tarihi: [.../.../......]. İşin toplam süresi [...] takvim günü olup iş bitiş tarihi [.../.../......] olarak öngörülmüştür.",
          "İş programı/iş kalemleri bazında haftalık-aylık takvim Ek-2'de yer alır. Yüklenici, iş programından önemli ölçüde (±%[...]) sapma olması hâlinde İşvereni gecikmeden yazılı olarak bilgilendirir.",
          "İşe başlama tarihi, gerekli izin/ruhsatların İşveren tarafından temin edildiği veya Yüklenicinin serbestçe işe başlayabildiği tarihten itibaren işlemeye başlar.",
        ],
      },
      {
        baslik: "MADDE 6 – ÖDEME KOŞULLARI",
        paragraflar: [
          "Toplam bedel Madde 2'de belirtilen [...] TL olup ödeme aşağıdaki şekilde yapılır:",
          "a) Sözleşme imzası ile birlikte avans: toplam bedelin %[...]'i, [...] TL.",
          "b) İş ilerleme (hakediş) ödemeleri: iş programındaki her aşamanın tamamlanmasını müteakip, o aşamaya isabet eden tutarın %[...]'i, [ödeme periyodu: haftalık/aylık/aşama bazlı] olarak.",
          "c) Geçici kabul sonrası ödeme: toplam bedelin %[...]'i.",
          "d) Kesin kabul sonrası (garanti kesintisi iadesi): toplam bedelin %[...]'i (teminat/garanti kesintisi).",
          "Ödemeler [banka havalesi/EFT] yoluyla Yüklenicinin bildireceği [...] IBAN numarasına yapılır. Geç ödemelerde 3095 sayılı Kanuni Faiz ve Temerrüt Faizine İlişkin Kanun hükümleri uygulanır.",
        ],
      },
      DENETIM_KABUL_MADDESI(7, "1"),
      CEZAI_SART_MADDESI(8),
      MUCBIR_SEBEP_MADDESI(9),
      FESIH_MADDESI(10),
      UYUSMAZLIK_MADDESI(11),
      {
        baslik: "MADDE 12 – YÜRÜRLÜK VE İMZA",
        paragraflar: [
          "İşbu Şartname, ekleriyle (Ek-1 Keşif/Metraj Listesi, Ek-2 İş Takvimi) birlikte toplam [...] sayfadan ibaret olup, [.../.../......] tarihinde taraflarca okunarak 2 (iki) nüsha olarak imzalanmış ve her bir taraf birer nüshasını almıştır.",
        ],
      },
    ],
  },

  "kat-karsiligi": {
    dosyaAdi: "kat-karsiligi.docx",
    kategori: "Kat Karşılığı",
    baslik: "KAT KARŞILIĞI İNŞAAT İŞLERİ ÖRNEK ŞARTNAMESİ",
    altBaslik: "(Arsa Payı Karşılığı Daire/İş Yeri Paylaşımı Esasına Dayalı İnşaat İşleri İçin Örnek Teknik ve Hukuki Şartname)",
    maddeler: [
      {
        baslik: "MADDE 1 – TARAFLAR VE TAŞINMAZ BİLGİLERİ",
        paragraflar: [
          "ARSA SAHİBİ/SAHİPLERİ: [Ad Soyad / Unvan], T.C. Kimlik No / Vergi No: [...], Adres: [...], Telefon: [...], E-posta: [...]. (Hisseli mülkiyette tüm hissedarlar ayrı ayrı belirtilir.)",
          "MÜTEAHHİT: [Ad Soyad / Firma Unvanı], Vergi No / Ticaret Sicil No: [...], Yapı Müteahhitliği Yetki Belgesi Grubu: [...], Adres: [...], Telefon: [...], E-posta: [...].",
          "TAŞINMAZIN TAPU BİLGİLERİ: İl/İlçe: [...], Mahalle: [...], Ada No: [...], Parsel No: [...], Yüzölçümü: [...] m², Mevcut İmar Durumu (TAKS/KAKS/Yükseklik): [...].",
          "Taraflar işbu Şartname'de sırasıyla \"Arsa Sahibi\" ve \"Müteahhit\" olarak anılacaktır.",
        ],
      },
      {
        baslik: "MADDE 2 – İŞİN TANIMI VE KAPSAMI",
        paragraflar: [
          "Müteahhit, Madde 1'de tapu bilgileri belirtilen arsa üzerinde, mimari projeye ve inşaat ruhsatına uygun olarak, kendi malzeme, işçilik, ekipman ve mali kaynaklarıyla bina inşa etmeyi; Arsa Sahibi ise arsasını bu inşaat karşılığında Müteahhide, işbu Şartname'deki paylaşım esasları çerçevesinde tahsis etmeyi kabul eder.",
          "Bina toplam [...] bağımsız bölümden (daire/dükkân/ofis) oluşacak olup, kat/blok bazında bağımsız bölüm listesi ve vaziyet planı işbu Şartname'nin Ek-1'idir. Mimari, statik, elektrik ve mekanik projeler Ek-2'de yer alır.",
          "İnşaat ruhsatı ve yapı kullanma izin belgesinin (iskân) alınması işlemleri, aksi kararlaştırılmadıkça, Müteahhit tarafından Arsa Sahibi adına/vekaletiyle yürütülür; resmi harç ve ruhsat giderleri [Müteahhide/Arsa Sahibine] aittir.",
        ],
      },
      {
        baslik: "MADDE 3 – TARAFLARIN YÜKÜMLÜLÜKLERİ",
        paragraflar: [
          "Arsa Sahibinin Yükümlülükleri: Tapuda ipotek, haciz, şerh vb. takyidat bulunmadığını beyan ve taahhüt etmek; inşaata başlanabilmesi için gerekli vekâletnameyi (inşaat yapım, proje onayı, ruhsat takibi vb. yetkileri kapsayacak şekilde) noterden düzenleyip Müteahhide vermek; Madde 6'da belirlenen pay devri/tapu işlemlerine süresinde icabet etmek.",
          "Müteahhidin Yükümlülükleri: İnşaatı ruhsatlı mimari/statik projeye, yürürlükteki İmar Kanunu, Yapı Denetim mevzuatı ve iş güvenliği mevzuatına tam uygun yürütmek; bir Yapı Denetim Kuruluşu ile sözleşme yapmak ve denetim hizmet bedelini karşılamak (aksi kararlaştırılmadıkça); tüm işçi ve alt yüklenicilerin SGK/iş güvenliği yükümlülüklerini yerine getirmek; inşaat süresince taşınmazı ve çevresini üçüncü kişilere karşı zarardan korumak, inşaat sigortası (All Risk) yaptırmak; Madde 4'teki süre ve Madde 5'teki standartlara riayet etmek.",
          "Müteahhit, Arsa Sahibine verdiği vekâletname kapsamındaki yetkileri yalnızca işbu Şartname konusu inşaat işi için kullanabilir; bu yetkiyi aşan (örn. arsayı veya inşa edilen bağımsız bölümleri üçüncü kişiye ipotek etmek, satmak) işlemler Arsa Sahibinin ayrıca yazılı onayına tabidir.",
        ],
      },
      {
        baslik: "MADDE 4 – İŞ SÜRESİ VE TAKVİM",
        paragraflar: [
          "İnşaata başlama tarihi (ruhsat alımını müteakip): [.../.../......]. Toplam inşaat süresi [...] ay/gün olup, kaba inşaatın tamamlanma tarihi [.../.../......], yapı kullanma izin belgesi (iskân) başvurusunun yapılacağı tarih en geç [.../.../......] olarak öngörülmüştür.",
          "Aşama bazlı iş takvimi (temel, kaba inşaat, ince işler, çevre düzenleme, iskân) Ek-3'te yer alır. Süre, Madde 8'de tanımlanan mücbir sebepler ve Arsa Sahibinden kaynaklanan gecikmeler (vekâletname/izin temininde gecikme vb.) oranında uzar.",
        ],
      },
      {
        baslik: "MADDE 5 – MALZEME VE İŞÇİLİK STANDARTLARI",
        paragraflar: [
          "İnşaat, TS 500 (betonarme), TS EN 1998 (deprem yönetmeliği/Türkiye Bina Deprem Yönetmeliği) ve ilgili tüm TSE/TS EN standartlarına uygun yürütülür; kullanılacak hazır beton sınıfı en az [...] (örn. C25/30), demir sınıfı [...] olarak taahhüt edilir.",
          "Isı yalıtımı TS 825'e, su yalıtımı TS 11758 serisine uygun yapılır. Bağımsız bölümlerde kullanılacak malzeme kalitesi (zemin kaplaması, mutfak/banyo malzemeleri, doğrama/PVC-ALÜMİNYUM, iç kapılar, boya) Ek-4 \"Malzeme ve Marka Listesi\"nde bağımsız bölüm tipine göre ayrıntılı olarak belirtilir; belirtilmeyen hususlarda orta-üst segment eşdeğeri esas alınır.",
          "Ortak alanlarda (lobi, merdiven, asansör, otopark, peyzaj) kullanılacak malzeme ve ekipman standardı da Ek-4'te ayrıca belirtilir.",
        ],
      },
      {
        baslik: "MADDE 6 – PAYLAŞIM KOŞULLARI VE TAPU DEVRİ",
        paragraflar: [
          "Taraflar, inşa edilecek toplam [...] bağımsız bölümün, Ek-1'deki liste uyarınca %[...]'inin (yaklaşık [...] bağımsız bölüm) Arsa Sahibine, %[...]'inin (yaklaşık [...] bağımsız bölüm) Müteahhide ait olacağı konusunda mutabıktır. Hangi bağımsız bölümlerin hangi tarafa isabet ettiği Ek-1'deki kat/daire numaralarıyla somutlaştırılmıştır (kura/karşılıklı seçim usulü: [...]).",
          "Arsa Sahibine isabet eden bağımsız bölümlerin tapularının devri, yapı kullanma izin belgesinin alınmasını müteakip en geç [...] gün içinde, kat irtifakı/kat mülkiyetine geçiş işlemleriyle birlikte yapılır.",
          "Tarafların karşılıklı yükümlülüklerini teminat altına almak üzere, [Arsa Sahibine isabet eden bağımsız bölümler üzerine inşaat ilerlemesine bağlı ipotek çözülmesi / Müteahhitten teminat mektubu alınması] usulü uygulanır: [...].",
          "Ortak gider (aidat) yükümlülüğü, bağımsız bölümün teslim/tapu tarihinden itibaren ilgili bağımsız bölüm sahibine geçer.",
        ],
      },
      DENETIM_KABUL_MADDESI(7, "5"),
      CEZAI_SART_MADDESI(8),
      MUCBIR_SEBEP_MADDESI(9),
      FESIH_MADDESI(10, [
        "İnşaat, toplam süresinin %[...]'i geçtiği hâlde fiziki gerçekleşme oranı iş programının belirgin biçimde (%[...] ve üzeri) gerisinde kalırsa, Arsa Sahibi Müteahhide en az 30 günlük ek süre vererek ihtarda bulunur; bu sürede de telafi edilmezse sözleşmeyi feshedip o ana kadarki imalat bedelini Madde 6'daki paylaşım oranı üzerinden mahsup ederek üçüncü bir yükleniciyle işi tamamlatabilir.",
      ]),
      UYUSMAZLIK_MADDESI(11),
      {
        baslik: "MADDE 12 – YÜRÜRLÜK VE İMZA",
        paragraflar: [
          "İşbu Şartname, ekleriyle (Ek-1 Bağımsız Bölüm/Paylaşım Listesi, Ek-2 Projeler, Ek-3 İş Takvimi, Ek-4 Malzeme ve Marka Listesi) birlikte toplam [...] sayfadan ibaret olup, [.../.../......] tarihinde taraflarca okunarak 2 (iki) nüsha olarak imzalanmış ve her bir taraf birer nüshasını almıştır. Taraflar, resmi sözleşmenin (kat karşılığı inşaat sözleşmesi) tapuda veya noterde düzenleme şeklinde ayrıca akdedileceğini kabul eder.",
        ],
      },
    ],
  },

  "kentsel-donusum": {
    dosyaAdi: "kentsel-donusum.docx",
    kategori: "Kentsel Dönüşüm",
    baslik: "KENTSEL DÖNÜŞÜM İNŞAAT İŞLERİ ÖRNEK ŞARTNAMESİ",
    altBaslik: "(6306 Sayılı Kanun Kapsamında Riskli Yapı Yıkım ve Yeniden İnşa İşleri İçin Örnek Teknik ve Hukuki Şartname)",
    maddeler: [
      {
        baslik: "MADDE 1 – TARAFLAR VE TAŞINMAZ BİLGİLERİ",
        paragraflar: [
          "MALİK(LER)/HAK SAHİBİ(LERİ): [Ad Soyad / Unvan], T.C. Kimlik No / Vergi No: [...], Adres: [...], Telefon: [...], E-posta: [...]. (Hisseli mülkiyette tüm hissedarlar ve hisse oranları ayrı ayrı belirtilir; 6306 s. Kanun m.6 uyarınca paydaşların 2/3 çoğunluğu esas alınır.)",
          "MÜTEAHHİT: [Ad Soyad / Firma Unvanı], Vergi No / Ticaret Sicil No: [...], Yapı Müteahhitliği Yetki Belgesi Grubu: [...], Adres: [...], Telefon: [...], E-posta: [...].",
          "TAŞINMAZIN TAPU BİLGİLERİ: İl/İlçe: [...], Mahalle: [...], Ada No: [...], Parsel No: [...], Yüzölçümü: [...] m².",
          "RİSKLİ YAPI TESPİTİ: Riskli Yapı Tespit Raporu Tarihi/No: [...], Çevre, Şehircilik ve İklim Değişikliği İl Müdürlüğü Onay Tarihi: [...], Tapu Şerhi Tarihi: [...].",
        ],
      },
      {
        baslik: "MADDE 2 – İŞİN TANIMI VE KAPSAMI",
        paragraflar: [
          "İşbu Şartname, 6306 sayılı Afet Riski Altındaki Alanların Dönüştürülmesi Hakkında Kanun kapsamında riskli yapı olarak tespit edilmiş/tespit edilecek binanın tahliyesi, yıkımı ve yerine mimari projeye uygun yeni bina inşa edilmesi işinin şartlarını düzenler.",
          "Müteahhit; tahliye, yıkım ruhsatı, yıkım, enkaz kaldırma, yeni inşaat ruhsatı ve yapı kullanma izin belgesi süreçlerinin tamamını, aksi belirtilmedikçe kendi organizasyonu ve mali kaynağıyla yürütür. Yeni bina toplam [...] bağımsız bölümden oluşacak olup vaziyet planı ve bağımsız bölüm listesi Ek-1'dir; mimari/statik/mekanik/elektrik projeler Ek-2'dir.",
          "Kentsel dönüşüm kapsamında sağlanan kolaylıklardan (KDV istisnası, harç/vergi muafiyetleri, kredi faiz desteği vb.) yararlanma işlemleri [...] tarafından takip edilir.",
        ],
      },
      {
        baslik: "MADDE 3 – TARAFLARIN YÜKÜMLÜLÜKLERİ",
        paragraflar: [
          "Malik(ler)in Yükümlülükleri: Binayı Madde 4'te belirlenen tahliye takvimine uygun olarak boşaltmak; yıkım ve yeni inşaat için gerekli vekâletnameyi noterden düzenlemek; tapu kaydındaki payını/payını Madde 7'deki paylaşım esaslarına göre devretmeyi kabul etmek.",
          "Müteahhidin Yükümlülükleri: Yıkım işlemini Çevresel Gürültü ve Titreşim Yönetmeliği ile iş güvenliği mevzuatına uygun, komşu parsellere zarar vermeyecek şekilde yaptırmak/yaptırtmak; enkazı lisanslı tesislere naklettirmek; Madde 5'te belirtilen kira yardımını süresinde ödemek; yeni inşaatı ruhsatlı projeye, Türkiye Bina Deprem Yönetmeliği'ne ve Yapı Denetim mevzuatına tam uygun yürütmek; bir Yapı Denetim Kuruluşu ile sözleşme yapmak.",
          "Taraflar, riskli yapı sürecine ilişkin Çevre, Şehircilik ve İklim Değişikliği Bakanlığı/İl Müdürlüğü ve belediye nezdindeki tüm başvuru ve bildirimlerde iyi niyetle iş birliği yapmayı taahhüt eder.",
        ],
      },
      {
        baslik: "MADDE 4 – İŞ SÜRESİ VE TAKVİM",
        paragraflar: [
          "Tahliye için öngörülen süre: tebligat/tespit tarihinden itibaren [...] gün (kanuni azami süre 6306 s. Kanun uyarınca 60 gün olup gerekçeli hâllerde 30 gün uzatılabilir). Tahliye sonrası yıkım işleminin tamamlanma tarihi: [.../.../......].",
          "Yeni inşaata başlama tarihi (ruhsat alımını müteakip): [.../.../......]. Toplam inşaat süresi [...] ay olup, yapı kullanma izin belgesi başvurusu en geç [.../.../......] tarihinde yapılacaktır.",
          "Aşama bazlı takvim (tahliye, yıkım, ruhsat, kaba inşaat, ince işler, iskân) Ek-3'te yer alır.",
        ],
      },
      {
        baslik: "MADDE 5 – KİRA YARDIMI",
        paragraflar: [
          "Müteahhit, tahliye tarihinden yeni bağımsız bölümün teslimine kadar geçen süre boyunca, Malik(ler)e/Hak Sahiplerine aylık [...] TL kira yardımı öder. Ödeme her ayın [...] günü, malikin bildireceği [...] IBAN numarasına yapılır.",
          "Kira yardımı süresi, inşaat süresinin Madde 8'deki mücbir sebep veya Malik kaynaklı gecikmeler dışında uzaması hâlinde, gecikme süresince de kesintisiz devam eder.",
          "Taraflar, Çevre, Şehircilik ve İklim Değişikliği Bakanlığı'nın kira yardımı/faiz desteği programlarından ayrıca yararlanılıp yararlanılmayacağını ve bu desteğin Müteahhit ödemesinden mahsup edilip edilmeyeceğini burada belirtir: [...].",
        ],
      },
      {
        baslik: "MADDE 6 – MALZEME VE İŞÇİLİK STANDARTLARI",
        paragraflar: [
          "Yeni bina, Türkiye Bina Deprem Yönetmeliği (2018) ve TS 500 betonarme standardına tam uygun olarak, en az [...] beton sınıfı ve [...] demir sınıfı kullanılarak inşa edilir; Yapı Denetim Kuruluşu'nun tüm aşama onayları alınmadan bir sonraki imalata geçilmez.",
          "Isı yalıtımı TS 825, su yalıtımı TS 11758 serisine uygun yapılır. Bağımsız bölüm ve ortak alan malzeme/marka standardı Ek-4 \"Malzeme ve Marka Listesi\"nde belirtilir.",
        ],
      },
      {
        baslik: "MADDE 7 – PAYLAŞIM KOŞULLARI VE TAPU DEVRİ",
        paragraflar: [
          "Yeni inşa edilecek toplam [...] bağımsız bölümün Ek-1'deki liste uyarınca %[...]'i Malik(ler)e, %[...]'i Müteahhide isabet edecek şekilde paylaşılacaktır. Mevcut hisse oranlarına göre malikler arası dağılım Ek-1'de ayrıca gösterilir.",
          "Tapuların devri, yapı kullanma izin belgesinin alınmasını müteakip en geç [...] gün içinde kat mülkiyetine geçilerek yapılır.",
          "Teminat usulü (ipotek/teminat mektubu): [...].",
        ],
      },
      DENETIM_KABUL_MADDESI(8, "5"),
      CEZAI_SART_MADDESI(9),
      MUCBIR_SEBEP_MADDESI(10),
      FESIH_MADDESI(11, [
        "Müteahhidin kira yardımını üst üste 2 (iki) ay ödememesi veya yıkım/inşaat sürecini haklı sebep olmaksızın 60 günden fazla durdurması hâlinde Malik(ler) sözleşmeyi feshedebilir; bu hâlde Müteahhidin yapmış olduğu imalatın bedeli, alanında yeminli bilirkişi tarafından tespit edilerek Madde 7'deki paylaşım oranı üzerinden mahsuplaşmaya konu edilir.",
      ]),
      UYUSMAZLIK_MADDESI(12),
      {
        baslik: "MADDE 13 – YÜRÜRLÜK VE İMZA",
        paragraflar: [
          "İşbu Şartname, ekleriyle (Ek-1 Bağımsız Bölüm/Paylaşım Listesi, Ek-2 Projeler, Ek-3 İş Takvimi, Ek-4 Malzeme ve Marka Listesi) birlikte toplam [...] sayfadan ibaret olup, [.../.../......] tarihinde taraflarca okunarak 2 (iki) nüsha olarak imzalanmış ve her bir taraf birer nüshasını almıştır. Resmi sözleşmenin tapuda veya noterde düzenleme şeklinde ayrıca akdedileceği kabul edilmiştir.",
        ],
      },
    ],
  },

  "yapi-insaat": {
    dosyaAdi: "yapi-insaat.docx",
    kategori: "Yapı İnşaat",
    baslik: "YAPI İNŞAAT (SIFIRDAN İNŞAAT) İŞLERİ ÖRNEK ŞARTNAMESİ",
    altBaslik: "(Boş Arsa Üzerinde Anahtar Teslimi/Hakediş Usulü Yeni Bina İnşaatı İçin Örnek Teknik ve Hukuki Şartname)",
    maddeler: [
      {
        baslik: "MADDE 1 – TARAFLAR VE TAŞINMAZ BİLGİLERİ",
        paragraflar: [
          "İŞVEREN (ARSA SAHİBİ): [Ad Soyad / Unvan], T.C. Kimlik No / Vergi No: [...], Adres: [...], Telefon: [...], E-posta: [...].",
          "YÜKLENİCİ (MÜTEAHHİT): [Ad Soyad / Firma Unvanı], Vergi No / Ticaret Sicil No: [...], Yapı Müteahhitliği Yetki Belgesi Grubu: [...], Adres: [...], Telefon: [...], E-posta: [...].",
          "TAŞINMAZIN TAPU BİLGİLERİ: İl/İlçe: [...], Mahalle: [...], Ada No: [...], Parsel No: [...], Yüzölçümü: [...] m², İmar Durumu (TAKS/KAKS/Yükseklik/Kullanım Amacı): [...].",
        ],
      },
      {
        baslik: "MADDE 2 – İŞİN TANIMI VE KAPSAMI",
        paragraflar: [
          "Yüklenici, Madde 1'de tanımlanan boş arsa üzerinde, onaylı mimari/statik/mekanik/elektrik projelerine (Ek-1) ve inşaat ruhsatına tam uygun olarak [anahtar teslimi / kaba inşaat + ince işler hariç / belirtilecek kapsam: ...] esasıyla bina inşa etmeyi taahhüt eder.",
          "İşin sözleşme bedeli (keşif bedeli) [...] TL (KDV [Dahil/Hariç]) olup, birim fiyat/metraj cetveli Ek-2'dir. İş; temel-altyapı, kaba inşaat, çatı, ince işler (sıva-boya-kaplama), mekanik tesisat, elektrik tesisatı, dış cephe ve çevre düzenlemesi kalemlerinden oluşur; kapsam dışı bırakılan kalemler: [...].",
          "Ruhsat ve yapı kullanma izin belgesi (iskân) süreci [İşveren/Yüklenici] tarafından, diğer tarafça verilecek vekâletname ile yürütülür; resmi harç ve ruhsat giderleri [...] tarafından karşılanır.",
        ],
      },
      {
        baslik: "MADDE 3 – TARAFLARIN YÜKÜMLÜLÜKLERİ",
        paragraflar: [
          "İşverenin Yükümlülükleri: Arsanın imar durumu, zemin etüdü ve tapu kaydına ilişkin doğru bilgi ve belgeleri Yükleniciye sağlamak; inşaata elverişli şekilde arsayı teslim etmek; Madde 6'daki hakediş ödemelerini süresinde yapmak; proje tadilat taleplerini yazılı ve zamanında bildirmek.",
          "Yüklenicinin Yükümlülükleri: İşi ruhsatlı projeye, Türkiye Bina Deprem Yönetmeliği'ne, İmar Kanunu'na ve Yapı Denetimi Hakkında Kanun'a (4708 s.) tam uygun yürütmek; bir Yapı Denetim Kuruluşu ile sözleşme yapmak ve şantiye şefi/uygulama sorumlusu bulundurmak; tüm işçi ve alt yükleniciler için SGK bildirimi ve iş sağlığı-güvenliği (6331 s. Kanun) tedbirlerini almak; şantiye sigortası (All Risk/CAR) ve üçüncü şahıs mali sorumluluk sigortası yaptırmak; zemin etüdüne aykırı beklenmedik durumları derhal İşverene bildirmek.",
        ],
      },
      {
        baslik: "MADDE 4 – MALZEME VE İŞÇİLİK STANDARTLARI",
        paragraflar: [
          "İnşaat; TS 500 (betonarme tasarım), Türkiye Bina Deprem Yönetmeliği (2018), TS EN 206 (hazır beton) standartlarına uygun yürütülür. Beton sınıfı en az [...] (örn. C30/37), donatı çeliği [...] olarak taahhüt edilir; her dökümde beton numunesi alınır ve basınç dayanım raporları İşverenle paylaşılır.",
          "Isı yalıtımı TS 825, su yalıtımı TS 11758 serisine, elektrik tesisatı TS HD 60364 serisine, doğalgaz tesisatı TS 7363'e uygun yapılır.",
          "Kaba ve ince işlerde kullanılacak malzeme marka/model/kalite sınıfı Ek-3 \"Malzeme ve Marka Listesi\"nde belirtilir; listede belirtilmeyen kalemlerde orta-üst segment eşdeğer ürün esas alınır. Muadil malzeme kullanımı İşverenin yazılı onayına tabidir.",
        ],
      },
      {
        baslik: "MADDE 5 – İŞ SÜRESİ VE TAKVİM",
        paragraflar: [
          "İşe başlama tarihi (ruhsat alımı ve arsa tesliminden sonra): [.../.../......]. Toplam inşaat süresi [...] ay/gün olup, kaba inşaatın bitiş tarihi [.../.../......], anahtar teslim/iskân başvuru tarihi en geç [.../.../......] olarak öngörülmüştür.",
          "Aşama bazlı iş programı (hafriyat-temel, kaba inşaat, çatı, ince işler, çevre düzeni, iskân) Ek-4'te yer alır; Yüklenici iş programından %[...] ve üzeri sapma hâlinde İşvereni derhal yazılı bilgilendirir.",
        ],
      },
      {
        baslik: "MADDE 6 – ÖDEME (HAKEDİŞ) KOŞULLARI",
        paragraflar: [
          "Toplam sözleşme bedeli Madde 2'de belirtilen [...] TL olup ödeme hakediş usulüyle yapılır:",
          "a) Sözleşme imzası ile birlikte avans: %[...], [...] TL (avans, ilerleyen hakedişlerden orantılı olarak mahsup edilir).",
          "b) Aylık/aşama bazlı hakediş: Yüklenici, tamamlanan imalatı gösteren metraj/hakediş raporunu her ayın/aşamanın sonunda İşverene/denetçiye sunar; İşveren [...] iş günü içinde onaylar veya gerekçeli itirazını bildirir; onaylanan hakediş tutarı [...] iş günü içinde ödenir.",
          "c) Geçici kabul sonrası ödeme: %[...].",
          "d) Kesin kabul sonrası (garanti/teminat kesintisi iadesi): %[...] (bu tutar Madde 7'deki garanti süresi sonunda iade edilir).",
          "Geç ödemelerde 3095 sayılı Kanun uyarınca kanuni faiz uygulanır; Yüklenici, İşverenin 30 günden fazla süren ödeme gecikmesinde işi haklı sebeple askıya alma hakkına sahiptir.",
        ],
      },
      DENETIM_KABUL_MADDESI(7, "5"),
      CEZAI_SART_MADDESI(8),
      MUCBIR_SEBEP_MADDESI(9),
      FESIH_MADDESI(10, [
        "İnşaatın fiziki gerçekleşme oranının, ödenen hakediş tutarına kıyasla önemli ölçüde geride kalması (İşverenin fazladan ödeme yapmış duruma düşmesi) hâlinde İşveren, bağımsız bir bilirkişi tespitiyle durumu belgeleyerek Yükleniciye 15 günlük düzeltme süresi verir; düzeltilmezse sözleşmeyi feshedebilir.",
      ]),
      UYUSMAZLIK_MADDESI(11),
      {
        baslik: "MADDE 12 – YÜRÜRLÜK VE İMZA",
        paragraflar: [
          "İşbu Şartname, ekleriyle (Ek-1 Projeler, Ek-2 Birim Fiyat/Metraj Cetveli, Ek-3 Malzeme ve Marka Listesi, Ek-4 İş Takvimi) birlikte toplam [...] sayfadan ibaret olup, [.../.../......] tarihinde taraflarca okunarak 2 (iki) nüsha olarak imzalanmış ve her bir taraf birer nüshasını almıştır.",
        ],
      },
    ],
  },
};
