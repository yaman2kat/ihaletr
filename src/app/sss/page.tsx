"use client";

import { useState } from "react";
import Link from "next/link";

interface Soru {
  s: string;
  c: string;
}

interface Kategori {
  baslik: string;
  sorular: Soru[];
}

const KATEGORILER: Kategori[] = [
  {
    baslik: "Genel",
    sorular: [
      {
        s: "İhaleTR platformu nasıl çalışır?",
        c: "Arsa sahipleri ve kurumlar, taşınmaz bilgilerini (il/ilçe/mahalle/ada/parsel/m²) ve gerekli belgeleri ekleyerek İhale Oluştur formuyla ihale yayınlar. Müteahhitler ihaleyi inceler ve teklif verir. İhale süresi dolduğunda sonuç raporu oluşur ve ihale sahibi en uygun teklifi değerlendirir.",
      },
      {
        s: "İhale nasıl oluşturulur?",
        c: "\"İhale Oluştur\" sayfasında başlık, kategori, açıklama, kurum/firma, taşınmaz bilgileri (il, ilçe, mahalle, ada, parsel, m² — tümü zorunlu), başlangıç fiyatı ve son teklif tarihini girip gerekli belgeleri yüklediğinizde ihaleniz yayınlanır ve İhaleler sayfasında listelenir.",
      },
      {
        s: "Platformu kullanmak için kayıt olmam şart mı?",
        c: "İhale görüntülemek için hesap gerekmez. Şu an ihale oluşturma ve teklif verme de girişsiz kullanılabiliyor; ancak teklif geçmişinizi takip etmek, bildirim almak ve müteahhit profili oluşturmak için hesap açmanızı öneririz.",
      },
    ],
  },
  {
    baslik: "Üyelik ve Ücretlendirme",
    sorular: [
      {
        s: "Üyelik planları arasındaki farklar nelerdir?",
        c: "Ücretsiz plan 1 aktif ihale ve en fazla 5 gün ihale süresiyle sınırlıdır, süre uzatma içermez. Premium plan sınırsız aktif ihale, 45 güne kadar ihale süresi/uzatma ve teklifçi analitikleri sunar. Kurumsal plan 90 güne kadar süre/uzatma, 10 kullanıcılı hesap, özel API erişimi ve SLA garantisi ile en kapsamlı pakettir. Detaylar için Premium sayfasındaki karşılaştırma tablosuna bakabilirsiniz.",
      },
      {
        s: "Teklif verme ücretlendirmesi nasıl işliyor?",
        c: "Teklif vermek \"teklif hakkı\" tüketir. Her hesaba tanınan ücretsiz haklar bittiğinde, Teklif Paketi sayfasından Başlangıç (5 hak), Standart (15 hak) veya sınırsız aylık Pro paketlerinden birini satın alarak teklif vermeye devam edebilirsiniz.",
      },
      {
        s: "İlk 2 teklifim neden ücretsiz?",
        c: "Yeni açılan her hesaba otomatik olarak 2 ücretsiz teklif hakkı tanımlanır; böylece bir paket satın almadan önce platformu ve teklif verme sürecini deneyebilirsiniz. Bu haklar herhangi bir ihaleye teklif verdiğinizde otomatik olarak düşer.",
      },
      {
        s: "Teklif hakkım biterse ne olur?",
        c: "Kalan teklif hakkınız 0 olduğunda yeni teklif veremezsiniz; ihale sayfasındaki teklif kutusu sizi Teklif Paketi sayfasına yönlendirir. Yeni bir paket satın aldığınızda hakkınız hesabınıza hemen tanımlanır.",
      },
      {
        s: "İade politikanız nedir?",
        c: "Premium ve Kurumsal abonelik planları 14 gün iade güvencesiyle sunulur. Tek seferlik teklif paketleri (Başlangıç/Standart) kullanılmaya başlanmadıysa iptal talepleri destek ekibimiz tarafından değerlendirilir; talepleriniz için İletişim sayfasından bize ulaşabilirsiniz.",
      },
    ],
  },
  {
    baslik: "İhale Süreci",
    sorular: [
      {
        s: "İhale süresiyle ilgili kurallar nelerdir?",
        c: "İhale oluştururken seçebileceğiniz son teklif tarihi planınıza göre sınırlıdır: Ücretsiz planda en fazla 5 gün, Premium planda en fazla 45 gün, Kurumsal planda en fazla 90 gün. İdeal ihale süresi olarak başlangıç tarihinden itibaren 20-30 gün önerilir.",
      },
      {
        s: "İhale süresini nasıl uzatabilirim?",
        c: "Süresi dolmuş bir ihalenin detay sayfasındaki \"İhale Sonucunu Göster\" raporu içinden \"İhaleyi Uzat\" bölümünü kullanabilirsiniz. Ücretsiz planda uzatma yapılamaz; Premium ve Kurumsal planlarda toplam ihale süresi (zaten geçen süre dahil) planınızın üst sınırını (45 / 90 gün) aşamaz.",
      },
      {
        s: "En düşük/en yüksek teklifi kimler görebilir?",
        c: "İhale aktif olduğu sürece bu bilgiyi hiç kimse göremez — ihale sahibi de dahil. İhale süresi dolduktan veya sonlandırıldıktan sonra bu bilgi yalnızca ihaleyi oluşturan kişiye, o ihaleye teklif vermiş katılımcılara ve Kurumsal plan sahibi kullanıcılara açılır. İhaleler listesindeki kartlarda da bu bilgi sadece süresi dolmuş (ve uzatılmamış) ihalelerde gösterilir.",
      },
    ],
  },
  {
    baslik: "Güvenlik ve Belgeler",
    sorular: [
      {
        s: "Ödeme bilgilerim güvende mi?",
        c: "Tüm ödemeler iyzico altyapısı üzerinden 3D Secure ile işlenir. Kart bilgileriniz İhaleTR sunucularında saklanmaz; ödeme sağlayıcımızın PCI-DSS uyumlu güvenli sistemlerinde işlenir.",
      },
      {
        s: "İhale oluştururken hangi belgeleri yüklemem zorunlu?",
        c: "Yapı Şartnamesi ve Tapu Fotokopisi her ihalede zorunludur. \"Proje\" alanında \"Var\" seçtiyseniz PDF veya DWG formatında Bina Projesi dosyası da zorunlu hale gelir. Sözleşme Tasarısı isteğe bağlıdır. Tapu Fotokopisi yalnızca ihalenin gerçekliğini doğrulamak için istenir; hiçbir kullanıcı veya müteahhit tarafından görüntülenemez ya da indirilemez, yalnızca yetkili yöneticiler erişebilir.",
      },
    ],
  },
  {
    baslik: "Müteahhitler",
    sorular: [
      {
        s: "Müteahhit profili nasıl oluşturulur?",
        c: "Kayıt Ol sayfasında hesap türü olarak \"Müteahhit\"i seçip firma adı ve Müteahhitlik Yetki Belgesi Grubunuzu girerek hesabınızı oluşturursunuz. Giriş yaptıktan sonra profilinizi düzenle sayfasından uzmanlık alanlarınızı, çalıştığınız illeri, sertifikalarınızı ve referans projelerinizi ekleyerek profilinizi tamamlayabilirsiniz.",
      },
      {
        s: "Bir müteahhitin geçmiş projelerini ve yorumlarını nasıl görebilirim?",
        c: "Müteahhitler sayfasından firma adına göre arama yaparak tüm müteahhit profillerine ulaşabilirsiniz. Her profilde tamamlanan proje sayısı, referans projeler, uzmanlık alanları ve önceki müşterilerin yorum/puanları yer alır.",
      },
    ],
  },
];

function SoruKarti({ soru }: { soru: Soru }) {
  const [acik, setAcik] = useState(false);
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setAcik((a) => !a)}
        className="w-full flex items-center justify-between gap-4 text-left px-5 py-4"
      >
        <span className="font-semibold text-gray-900 text-sm">{soru.s}</span>
        <svg
          className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${acik ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {acik && (
        <div className="px-5 pb-4">
          <p className="text-sm text-gray-500 leading-relaxed">{soru.c}</p>
        </div>
      )}
    </div>
  );
}

export default function SssSayfasi() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-8">
        <Link href="/" className="hover:text-blue-700">Ana Sayfa</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Sık Sorulan Sorular</span>
      </nav>

      <div className="text-center mb-10">
        <span className="inline-block text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full mb-4 tracking-wide uppercase">
          SSS
        </span>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Sık Sorulan Sorular</h1>
        <p className="text-gray-500 text-base max-w-lg mx-auto">
          Platformun işleyişi, üyelik planları ve ihale süreçleriyle ilgili en çok sorulan sorular.
          Aradığınızı bulamazsanız destek ekibimizle iletişime geçebilirsiniz.
        </p>
      </div>

      <div className="flex flex-col gap-10 mb-12">
        {KATEGORILER.map((kat) => (
          <div key={kat.baslik}>
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-4">{kat.baslik}</h2>
            <div className="flex flex-col gap-3">
              {kat.sorular.map((soru) => (
                <SoruKarti key={soru.s} soru={soru} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Alt bağlantılar */}
      <div className="flex items-center justify-center gap-4">
        <Link href="/danismanlar"
          className="flex items-center gap-2 text-blue-700 font-semibold hover:underline text-sm">
          Destek Merkezi
        </Link>
        <span className="text-gray-300">|</span>
        <Link href="/iletisim"
          className="text-gray-500 hover:text-blue-700 font-medium text-sm transition-colors">
          İletişime Geç
        </Link>
      </div>
    </div>
  );
}
