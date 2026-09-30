// Ihale Arsivi ozelligini canli veritabaninda dogrular:
// 1) ihale_arsivle() -- kazanan_secim_tarihi 30 gunden eski ve durum
//    'tamamlandi' olan bir ihaleyi gercekten 'arsiv' durumuna tasiyor mu.
// 2) Arsivlenen ihale, /ihaleler ana listesinin kullandigi sorgudan
//    (inceleme_durumu='onaylandi' + durum<>'arsiv') dislaniyor mu.
// 3) ihale_arsiv_teklif_listesi_maskeli(): Kurumsal plan sahibi hem isim
//    hem tutarin MASKELI halini goruyor mu; kurumsal olmayan/katilimci
//    olmayan biri HICBIR satir gormuyor mu.
// 4) tutar_maskele() beklenen formati uretiyor mu.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(URL, env.SUPABASE_SERVICE_ROLE_KEY);

const PASSWORD = "TestSifre123!";
const STAMP = Date.now();
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${detail ? " (" + detail + ")" : ""}`);
}

const created = { authUserIds: [], ihaleIds: [] };

function clientFor() { return createClient(URL, ANON_KEY); }
async function signedInClient(email) {
  const c = clientFor();
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return c;
}
async function createUser(tag) {
  const email = `test-live-arsiv-${tag}-${STAMP}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  return { id: data.user.id, email };
}

async function cleanup() {
  console.log("\n--- temizlik ---");
  if (created.ihaleIds.length) await admin.from("teklifler").delete().in("ihale_id", created.ihaleIds);
  if (created.ihaleIds.length) await admin.from("ihaleler").delete().in("id", created.ihaleIds);
  for (const id of created.authUserIds) await admin.auth.admin.deleteUser(id).catch(() => {});
  console.log("temizlik tamamlandi.");
}

async function main() {
  // ---- Kurulum ----
  const sahibi = await createUser("sahibi");
  const muteahhitX = await createUser("muteahhit-x");
  const muteahhitY = await createUser("muteahhit-y");
  const kurumsalIzleyici = await createUser("kurumsal-izleyici");
  const disiKullanici = await createUser("disi-kullanici");
  created.authUserIds.push(sahibi.id, muteahhitX.id, muteahhitY.id, kurumsalIzleyici.id, disiKullanici.id);

  // kalan_teklif_hakki varsayilani 0'dir (bkz. schema.sql) -- trg_teklif_hakki_kontrol
  // bu deger 0 iken teklif INSERT'ini reddeder, service role da bundan muaf degil.
  await admin.from("kullanicilar").update({ firma_adi: "Mavi Yapi Insaat Ltd Sti", kalan_teklif_hakki: 5 }).eq("id", muteahhitX.id);
  await admin.from("kullanicilar").update({ firma_adi: "Deniz Insaat Taahhut A.S.", kalan_teklif_hakki: 5 }).eq("id", muteahhitY.id);
  await admin.from("kullanicilar").update({ plan_turu: "kurumsal" }).eq("id", kurumsalIzleyici.id);

  const bitis = new Date(); bitis.setDate(bitis.getDate() - 45);
  const baslangic = new Date(); baslangic.setDate(baslangic.getDate() - 75);

  const { data: ihale, error: ihaleErr } = await admin.from("ihaleler").insert({
    baslik: `[CANLI TEST] Arsiv ihalesi ${STAMP}`,
    aciklama: "Canli test - ihale arsivi RPC/cron dogrulamasi.",
    kategori: "Bakım & Onarım",
    baslangic_tarihi: baslangic.toISOString().slice(0, 10),
    bitis_tarihi: bitis.toISOString().slice(0, 10),
    baslangic_fiyati: 1000000,
    kurum: "Test Kurum",
    sehir: "İstanbul",
    ilce: "Kadıköy",
    durum: "tamamlandi",
    inceleme_durumu: "onaylandi",
    olusturan_id: sahibi.id,
  }).select().single();
  if (ihaleErr) throw ihaleErr;
  created.ihaleIds.push(ihale.id);

  const { error: txErr } = await admin.from("teklifler").insert({ ihale_id: ihale.id, kullanici_id: muteahhitX.id, tutar: 1250000 });
  if (txErr) throw txErr;
  const { error: tyErr } = await admin.from("teklifler").insert({ ihale_id: ihale.id, kullanici_id: muteahhitY.id, tutar: 1380000 });
  if (tyErr) throw tyErr;

  // Kazanani sec -- trg_ihale_kapatildi_bildir bu UPDATE'te kazanan_secim_tarihi'ni now() yapar.
  const { error: secErr } = await admin.from("ihaleler").update({ secilen_firma_id: muteahhitX.id }).eq("id", ihale.id);
  if (secErr) throw secErr;

  const { data: aninSecim } = await admin.from("ihaleler").select("kazanan_secim_tarihi").eq("id", ihale.id).single();
  check("kazanan secilince kazanan_secim_tarihi otomatik damgalaniyor", !!aninSecim?.kazanan_secim_tarihi, `donen: ${aninSecim?.kazanan_secim_tarihi}`);

  // 30+ gun once secilmis gibi geriye tarihle -- cron'un gercekten
  // yakalayacagi durumu simule eder.
  const gecmisTarih = new Date(); gecmisTarih.setDate(gecmisTarih.getDate() - 31);
  await admin.from("ihaleler").update({ kazanan_secim_tarihi: gecmisTarih.toISOString() }).eq("id", ihale.id);

  console.log("--- kurulum tamam, ihale_arsivle() calistiriliyor ---\n");

  // ---- 1) ihale_arsivle() gercekten arsivliyor mu ----
  const { error: arsivErr } = await admin.rpc("ihale_arsivle");
  if (arsivErr) throw arsivErr;

  const { data: arsivSonrasi } = await admin.from("ihaleler").select("durum").eq("id", ihale.id).single();
  check("30 gunden eski kazanan_secim_tarihi'li ihale 'arsiv' durumuna gecti", arsivSonrasi?.durum === "arsiv", `donen: ${arsivSonrasi?.durum}`);

  // ---- 2) /ihaleler ana listesi sorgusu arsivi disliyor mu ----
  const anon = clientFor();
  const { data: anaListe } = await anon.from("ihaleler").select("id").eq("inceleme_durumu", "onaylandi").neq("durum", "arsiv");
  const anaListedeVarMi = (anaListe ?? []).some((i) => i.id === ihale.id);
  check("arsivlenen ihale /ihaleler ana liste sorgusunda GORUNMEMELI", !anaListedeVarMi);

  // ihale_teklif_sayilari arsiv ihalesi icin de calisiyor mu (arsiv sayfasi karti icin).
  const { data: sayilar } = await anon.rpc("ihale_teklif_sayilari", { p_ihale_idler: [ihale.id] });
  check("arsiv ihalesi icin teklif sayisi 2 donuyor", sayilar?.[0]?.sayi === 2, `donen: ${JSON.stringify(sayilar)}`);

  // ---- 3) Maskeli teklif listesi RPC ----
  const kurumsalClient = await signedInClient(kurumsalIzleyici.email);
  const { data: maskeliListe, error: maskeliErr } = await kurumsalClient.rpc("ihale_arsiv_teklif_listesi_maskeli", { p_ihale_id: ihale.id });
  if (maskeliErr) throw maskeliErr;
  check("kurumsal kullanici 2 maskeli teklif satiri goruyor", (maskeliListe ?? []).length === 2, `adet: ${maskeliListe?.length}`);
  const gercekIsimVarMi = (maskeliListe ?? []).some((r) => r.isim_maskeli === "Mavi Yapi Insaat Ltd Sti" || r.isim_maskeli === "Deniz Insaat Taahhut A.S.");
  check("firma isimleri GERCEK haliyle DONMEMELI (maskeli olmali)", !gercekIsimVarMi, `donen: ${JSON.stringify(maskeliListe)}`);
  const gercekTutarVarMi = (maskeliListe ?? []).some((r) => r.tutar_maskeli?.replace(/[^0-9]/g, "") === "1250000" || r.tutar_maskeli?.replace(/[^0-9]/g, "") === "1380000");
  check("tutarlar GERCEK haliyle DONMEMELI (maskeli olmali)", !gercekTutarVarMi, `donen: ${JSON.stringify(maskeliListe?.map(r => r.tutar_maskeli))}`);
  const maskeliFormatDogruMu = (maskeliListe ?? []).every((r) => /^\d{1,2}[.•]/.test(r.tutar_maskeli ?? ""));
  check("tutar_maskeli format ilk rakamlari acik birakiyor (orn. 1.2••.••• ₺)", maskeliFormatDogruMu, `donen: ${JSON.stringify(maskeliListe?.map(r => r.tutar_maskeli))}`);

  // ---- 4) Kurumsal olmayan / katilimci olmayan biri hicbir satir gormemeli ----
  const disiClient = await signedInClient(disiKullanici.email);
  const { data: disiListe } = await disiClient.rpc("ihale_arsiv_teklif_listesi_maskeli", { p_ihale_id: ihale.id });
  check("kurumsal olmayan/katilimci olmayan kullanici HICBIR satir gormemeli", (disiListe ?? []).length === 0, `adet: ${disiListe?.length}`);

  // Giris yapmamis (anon) da hicbir satir gormemeli.
  const { data: anonListe } = await anon.rpc("ihale_arsiv_teklif_listesi_maskeli", { p_ihale_id: ihale.id });
  check("anon (girissiz) kullanici HICBIR satir gormemeli", (anonListe ?? []).length === 0, `adet: ${anonListe?.length}`);

  console.log(`\n--- SONUC: ${results.filter((r) => r.ok).length}/${results.length} basarili ---`);
  const basarisizlar = results.filter((r) => !r.ok);
  if (basarisizlar.length) {
    console.log("BASARISIZ testler:", basarisizlar.map((r) => r.name));
    process.exitCode = 1;
  }

  // Tarayici testi icin ihale id'sini yazdir (bu script cleanup'ta siler,
  // tarayici dogrulamasi ayni calistirma icinde, silmeden ONCE yapilmali).
  console.log(`\nTarayici testi icin: kurumsalIzleyici=${kurumsalIzleyici.email} / ${PASSWORD}`);
  console.log(`ihale.id=${ihale.id}`);

  return { kurumsalIzleyici, ihaleId: ihale.id };
}

// --no-cleanup: tarayicidan gorsel dogrulama yapabilmek icin test
// verisini silmeden birakir; sonrasinda `node live-test-ihale-arsivi.mjs --cleanup-only <ihaleId> <userId...>`
// ile elle temizlenir.
const noCleanup = process.argv.includes("--no-cleanup");

if (process.argv.includes("--cleanup-only")) {
  const idx = process.argv.indexOf("--cleanup-only");
  created.ihaleIds.push(process.argv[idx + 1]);
  created.authUserIds.push(...process.argv.slice(idx + 2));
  await cleanup();
} else {
  try {
    await main();
  } finally {
    if (!noCleanup) await cleanup();
    else console.log("\n--no-cleanup verildi, test verisi SILINMEDI.");
  }
}
