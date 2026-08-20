// Iki degisikligi canli veritabaninda dogrular:
// 1) Ihale sahibi, kendi BITMIS ihalesine teklif vermis TUM muteahhitlerin
//    profiline (telefon/email/web_sitesi dahil) tam erisime sahip olmali --
//    kazanan secilmis olmasi sart degil (onceki "sadece kazanan" kisiti
//    kaldirildi).
// 2) ihale_teklif_listesi_maskeli(): bir katilimci kendi satirinda GERCEK
//    firma adini gorur, diger katilimcilarin adlari maskeli kalir.
//    Katilimci olmayan (ne teklif veren ne kurumsal) biri hicbir satir
//    gormemeli; sadece kurumsal plan sahibi (teklif vermemis) TUM
//    satirlari maskeli gormeli (kendi satiri olmadigindan).

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

async function createUser(tag) {
  const email = `test-live-rakip-${tag}-${STAMP}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  return { id: data.user.id, email };
}
function clientFor() { return createClient(URL, ANON_KEY); }
async function signedInClient(email) {
  const c = clientFor();
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return c;
}

const created = { authUserIds: [], ihaleIds: [], muteahhitIds: [] };

async function cleanup() {
  console.log("\n--- temizlik ---");
  if (created.ihaleIds.length) await admin.from("ihaleler").delete().in("id", created.ihaleIds);
  for (const id of created.muteahhitIds) await admin.from("muteahhit_profiller").delete().eq("kullanici_id", id);
  for (const id of created.authUserIds) await admin.auth.admin.deleteUser(id).catch(() => {});
  console.log("temizlik tamamlandi.");
}

async function main() {
  // ---- Kurulum ----
  const sahibiA = await createUser("sahibi-a");
  const sahibiIlgisiz = await createUser("sahibi-ilgisiz");
  const muteahhitX = await createUser("muteahhit-x");
  const muteahhitY = await createUser("muteahhit-y");
  const kurumsalIzleyici = await createUser("kurumsal-izleyici");
  created.authUserIds.push(sahibiA.id, sahibiIlgisiz.id, muteahhitX.id, muteahhitY.id, kurumsalIzleyici.id);
  created.muteahhitIds.push(muteahhitX.id, muteahhitY.id);

  const { error: fxErr } = await admin.from("kullanicilar").update({ firma_adi: "Mavi Yapi Insaat Ltd Sti" }).eq("id", muteahhitX.id);
  if (fxErr) throw fxErr;
  const { error: fyErr } = await admin.from("kullanicilar").update({ firma_adi: "Deniz Insaat Taahhut A.S." }).eq("id", muteahhitY.id);
  if (fyErr) throw fyErr;
  const { error: kurErr } = await admin.from("kullanicilar").update({ plan_turu: "kurumsal" }).eq("id", kurumsalIzleyici.id);
  if (kurErr) throw kurErr;

  const { error: profXErr } = await admin.from("muteahhit_profiller").insert({
    kullanici_id: muteahhitX.id, firma_adi: "Mavi Yapi Insaat Ltd Sti",
    calistigi_iller: ["İstanbul"], uzmanlik_alanlari: ["Yapı İnşaat"],
    telefon: "0555 111 11 11", email: "mavi@example.com", web_sitesi: "www.maviyapi.example.com",
  });
  if (profXErr) throw profXErr;

  const bugun = new Date();
  const gecmis = (g) => new Date(bugun.getTime() - g * 86400000).toISOString().slice(0, 10);

  const { data: ihaleA, error: ihaleErr } = await admin.from("ihaleler").insert({
    baslik: `Test Ihale RakipTeklif ${STAMP}`, aciklama: "Canli test - rakip teklif ve tam erisim.",
    kategori: "Kat Karşılığı", baslangic_tarihi: gecmis(20), bitis_tarihi: gecmis(1),
    baslangic_fiyati: 1000000, kurum: "Test Kurum", sehir: "İstanbul",
    olusturan_id: sahibiA.id, durum: "tamamlandi",
  }).select("id").single();
  if (ihaleErr) throw ihaleErr;
  created.ihaleIds.push(ihaleA.id);

  // Kazanan HICBIR ZAMAN secilmiyor -- item 1'in "kazanan sart degil" iddiasini test eder.
  const { error: txErr } = await admin.from("teklifler").insert({ ihale_id: ihaleA.id, kullanici_id: muteahhitX.id, tutar: 900000 });
  if (txErr) throw txErr;
  const { error: tyErr } = await admin.from("teklifler").insert({ ihale_id: ihaleA.id, kullanici_id: muteahhitY.id, tutar: 950000 });
  if (tyErr) throw tyErr;

  console.log("--- kurulum tamam, testler basliyor ---\n");

  // ---- 1) Kazanan secilmemis olsa da profile tam erisim (telefon/email/web_sitesi) ----

  const sahibiAClient = await signedInClient(sahibiA.email);
  const { data: profilGorunumu } = await sahibiAClient.from("muteahhit_profiller").select("*").eq("kullanici_id", muteahhitX.id).maybeSingle();
  check("kazanan secilmemis olsa da ihale sahibi profili GOREBILMELI", profilGorunumu?.kullanici_id === muteahhitX.id);
  check("telefon tam gorunmeli", profilGorunumu?.telefon === "0555 111 11 11", `donen: ${profilGorunumu?.telefon}`);
  check("email tam gorunmeli", profilGorunumu?.email === "mavi@example.com", `donen: ${profilGorunumu?.email}`);
  check("web_sitesi tam gorunmeli", profilGorunumu?.web_sitesi === "www.maviyapi.example.com", `donen: ${profilGorunumu?.web_sitesi}`);

  const ilgisizClient = await signedInClient(sahibiIlgisiz.email);
  const { data: ilgisizProfil } = await ilgisizClient.from("muteahhit_profiller").select("*").eq("kullanici_id", muteahhitX.id).maybeSingle();
  check("alakasiz ihale sahibi (regresyon) profili GOREMEMELI", ilgisizProfil === null, `donen: ${JSON.stringify(ilgisizProfil)}`);

  // ---- 2) Rakip teklif listesi: kendi adin acik, digerleri maskeli ----

  const muteahhitXClient = await signedInClient(muteahhitX.email);
  const { data: listeX, error: listeXErr } = await muteahhitXClient.rpc("ihale_teklif_listesi_maskeli", { p_ihale_id: ihaleA.id });
  if (listeXErr) throw listeXErr;
  const kendiSatiriX = listeX?.find((r) => r.tutar === 900000);
  const rakipSatiriXdenGorulen = listeX?.find((r) => r.tutar === 950000);
  check("muteahhitX kendi teklifinde tutar dogru", kendiSatiriX?.tutar === 900000);
  check("muteahhitX kendi ADINI TAM gormeli", kendiSatiriX?.isim_maskeli === "Mavi Yapi Insaat Ltd Sti", `donen: ${kendiSatiriX?.isim_maskeli}`);
  check("muteahhitX rakibinin (Y) ADINI MASKELI gormeli", rakipSatiriXdenGorulen?.isim_maskeli !== "Deniz Insaat Taahhut A.S." && rakipSatiriXdenGorulen?.isim_maskeli?.includes("*"), `donen: ${rakipSatiriXdenGorulen?.isim_maskeli}`);

  const muteahhitYClient = await signedInClient(muteahhitY.email);
  const { data: listeY } = await muteahhitYClient.rpc("ihale_teklif_listesi_maskeli", { p_ihale_id: ihaleA.id });
  const kendiSatiriY = listeY?.find((r) => r.tutar === 950000);
  const rakipSatiriYdenGorulen = listeY?.find((r) => r.tutar === 900000);
  check("muteahhitY kendi ADINI TAM gormeli", kendiSatiriY?.isim_maskeli === "Deniz Insaat Taahhut A.S.", `donen: ${kendiSatiriY?.isim_maskeli}`);
  check("muteahhitY rakibinin (X) ADINI MASKELI gormeli", rakipSatiriYdenGorulen?.isim_maskeli !== "Mavi Yapi Insaat Ltd Sti" && rakipSatiriYdenGorulen?.isim_maskeli?.includes("*"), `donen: ${rakipSatiriYdenGorulen?.isim_maskeli}`);

  const { data: listeIlgisiz } = await ilgisizClient.rpc("ihale_teklif_listesi_maskeli", { p_ihale_id: ihaleA.id });
  check("katilimci olmayan/kurumsal olmayan kullanici HICBIR satir gormemeli", (listeIlgisiz ?? []).length === 0, `adet: ${listeIlgisiz?.length}`);

  const kurumsalClient = await signedInClient(kurumsalIzleyici.email);
  const { data: listeKurumsal } = await kurumsalClient.rpc("ihale_teklif_listesi_maskeli", { p_ihale_id: ihaleA.id });
  const kurumsalTumMaskeli = (listeKurumsal ?? []).length === 2 && listeKurumsal.every((r) => r.isim_maskeli.includes("*"));
  check("teklif vermemis kurumsal izleyici TUM isimleri MASKELI gormeli (kendi satiri yok)", kurumsalTumMaskeli, `donen: ${JSON.stringify(listeKurumsal)}`);

  console.log(`\n--- SONUC: ${results.filter(r => r.ok).length}/${results.length} basarili ---`);
  const basarisizlar = results.filter((r) => !r.ok);
  if (basarisizlar.length) {
    console.log("BASARISIZ testler:", basarisizlar.map((r) => r.name));
    process.exitCode = 1;
  }
}

try {
  await main();
} finally {
  await cleanup();
}
