// Muteahhit profil gizliligi (erisim + iletisim bilgisi maskeleme) icin
// canli veritabaninda uctan uca dogrulama. seed-live-test.mjs ile ayni
// desen: gecici test kullanicilari/verisi olusturur, RLS'i her rol icin
// dogru sinif (anon/sahibi/kazanan/bulusmus-ama-kazanmamis/ilgisiz/admin)
// altinda test eder, sonunda tum test verisini temizler.

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
  const email = `test-live-mgizlilik-${tag}-${STAMP}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
  });
  if (error) throw error;
  return { id: data.user.id, email };
}

function clientFor() {
  return createClient(URL, ANON_KEY);
}

async function signedInClient(email) {
  const c = clientFor();
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return c;
}

const created = {
  authUserIds: [],
  ihaleIds: [],
  muteahhitId: null,
  yorumIds: [],
  projeIds: [],
};

async function cleanup() {
  console.log("\n--- temizlik ---");
  if (created.yorumIds.length) await admin.from("muteahhit_yorumlar").delete().in("id", created.yorumIds);
  if (created.projeIds.length) await admin.from("muteahhit_referans_projeler").delete().in("id", created.projeIds);
  if (created.ihaleIds.length) await admin.from("ihaleler").delete().in("id", created.ihaleIds);
  if (created.muteahhitId) await admin.from("muteahhit_profiller").delete().eq("kullanici_id", created.muteahhitId);
  for (const id of created.authUserIds) {
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
  console.log("temizlik tamamlandi.");
}

async function main() {
  // ---- Kurulum ----
  const sahibiKazanan = await createUser("sahibi-kazanan");
  const sahibiBulusmus = await createUser("sahibi-bulusmus");
  const sahibiIlgisiz = await createUser("sahibi-ilgisiz");
  const muteahhitA = await createUser("muteahhit-a");
  const adminUser = await createUser("admin");
  created.authUserIds.push(sahibiKazanan.id, sahibiBulusmus.id, sahibiIlgisiz.id, muteahhitA.id, adminUser.id);
  created.muteahhitId = muteahhitA.id;

  const { error: adminRolErr } = await admin.from("kullanicilar").update({ rol: "admin" }).eq("id", adminUser.id);
  if (adminRolErr) throw adminRolErr;

  const { error: profilErr } = await admin.from("muteahhit_profiller").insert({
    kullanici_id: muteahhitA.id,
    firma_adi: "Test Gizlilik Insaat A.S.",
    calistigi_iller: ["İstanbul"],
    uzmanlik_alanlari: ["Yapı İnşaat"],
    telefon: "0555 000 00 00",
    email: "gizli-iletisim@example.com",
  });
  if (profilErr) throw profilErr;

  const bugun = new Date();
  const gecmis = (gunOnce) => new Date(bugun.getTime() - gunOnce * 86400000).toISOString().slice(0, 10);

  async function ihaleOlustur(olusturanId, baslikEk) {
    const { data, error } = await admin.from("ihaleler").insert({
      baslik: `Test Ihale ${baslikEk} ${STAMP}`,
      aciklama: "Canli test amacli gizlilik dogrulama ihalesi.",
      kategori: "Kat Karşılığı",
      baslangic_tarihi: gecmis(20),
      bitis_tarihi: gecmis(1),
      baslangic_fiyati: 1000000,
      kurum: "Test Kurum",
      sehir: "İstanbul",
      olusturan_id: olusturanId,
      durum: "tamamlandi",
    }).select("id").single();
    if (error) throw error;
    created.ihaleIds.push(data.id);
    return data.id;
  }

  const ihaleKazananId = await ihaleOlustur(sahibiKazanan.id, "kazanan");
  const ihaleBulusmusId = await ihaleOlustur(sahibiBulusmus.id, "bulusmus");
  await ihaleOlustur(sahibiIlgisiz.id, "ilgisiz"); // muteahhitA hic teklif vermiyor

  const { data: teklif1, error: t1Err } = await admin.from("teklifler").insert({
    ihale_id: ihaleKazananId, kullanici_id: muteahhitA.id, tutar: 950000,
  }).select("id").single();
  if (t1Err) throw t1Err;

  const { error: t2Err } = await admin.from("teklifler").insert({
    ihale_id: ihaleBulusmusId, kullanici_id: muteahhitA.id, tutar: 970000,
  });
  if (t2Err) throw t2Err;

  // Kazanan olarak sec: hem ihalenin secilen_firma_id'si hem teklifin
  // durumu 'kabul_edildi' olmali (uygulamadaki gercek akisla ayni).
  const { error: secErr } = await admin.from("ihaleler").update({ secilen_firma_id: muteahhitA.id }).eq("id", ihaleKazananId);
  if (secErr) throw secErr;
  const { error: kabulErr } = await admin.from("teklifler").update({ durum: "kabul_edildi" }).eq("id", teklif1.id);
  if (kabulErr) throw kabulErr;

  const { data: proje, error: projeErr } = await admin.from("muteahhit_referans_projeler").insert({
    muteahhit_id: muteahhitA.id, proje_adi: "Test Referans Proje", konum: "İstanbul", yil: 2024, tur: "Yapı İnşaat",
  }).select("id").single();
  if (projeErr) throw projeErr;
  created.projeIds.push(proje.id);

  // Yorum kasitli olarak burada DEGIL, ilgili "yorum yazma yetkisi"
  // testinde ekleniyor -- muteahhit_yorumlar(muteahhit_id, kullanici_id)
  // UNIQUE oldugundan ayni kullanicidan iki kez eklenemez.

  console.log("--- kurulum tamam, testler basliyor ---\n");

  // ---- 1) Profil erisimi (muteahhit_profiller SELECT) ----

  const anonClient = clientFor();
  const { data: anonProfil } = await anonClient.from("muteahhit_profiller").select("*").eq("kullanici_id", muteahhitA.id).maybeSingle();
  check("anon (giris yapmamis) profili GOREMEMELI", anonProfil === null, `donen: ${JSON.stringify(anonProfil)}`);

  const { data: anonVarMi } = await anonClient.rpc("muteahhit_profil_var_mi", { p_muteahhit_id: muteahhitA.id });
  check("anon icin muteahhit_profil_var_mi TRUE donmeli (404 vs 403 ayrimi)", anonVarMi === true);

  const kazananClient = await signedInClient(sahibiKazanan.email);
  const { data: kazananProfil } = await kazananClient.from("muteahhit_profiller").select("*").eq("kullanici_id", muteahhitA.id).maybeSingle();
  check("kazanan olarak secen ihale sahibi profili GOREBILMELI", kazananProfil?.kullanici_id === muteahhitA.id);

  const { data: kazananMi } = await kazananClient.rpc("muteahhit_ile_kazanan_olarak_bulusmus_mu", { p_muteahhit_id: muteahhitA.id });
  check("kazanan olarak secen ihale sahibi icin kazanan_mu TRUE", kazananMi === true);

  const bulusmusClient = await signedInClient(sahibiBulusmus.email);
  const { data: bulusmusProfil } = await bulusmusClient.from("muteahhit_profiller").select("*").eq("kullanici_id", muteahhitA.id).maybeSingle();
  check("teklif alan ama kazanan secmemis ihale sahibi profili GOREBILMELI (item 1)", bulusmusProfil?.kullanici_id === muteahhitA.id);

  const { data: bulusmusKazananMi } = await bulusmusClient.rpc("muteahhit_ile_kazanan_olarak_bulusmus_mu", { p_muteahhit_id: muteahhitA.id });
  check("kazanan secilmemisse kazanan_mu FALSE olmali (item 3 - iletisim gizli kalmali)", bulusmusKazananMi === false);

  const ilgisizClient = await signedInClient(sahibiIlgisiz.email);
  const { data: ilgisizProfil } = await ilgisizClient.from("muteahhit_profiller").select("*").eq("kullanici_id", muteahhitA.id).maybeSingle();
  check("alakasiz ihale sahibi profili GOREMEMELI", ilgisizProfil === null, `donen: ${JSON.stringify(ilgisizProfil)}`);

  const { data: ilgisizVarMi } = await ilgisizClient.rpc("muteahhit_profil_var_mi", { p_muteahhit_id: muteahhitA.id });
  check("alakasiz icin muteahhit_profil_var_mi yine TRUE donmeli", ilgisizVarMi === true);

  const muteahhitClient = await signedInClient(muteahhitA.email);
  const { data: kendiProfil } = await muteahhitClient.from("muteahhit_profiller").select("*").eq("kullanici_id", muteahhitA.id).maybeSingle();
  check("muteahhidin kendisi kendi profilini GOREBILMELI", kendiProfil?.kullanici_id === muteahhitA.id);

  const adminClient = await signedInClient(adminUser.email);
  const { data: adminProfil } = await adminClient.from("muteahhit_profiller").select("*").eq("kullanici_id", muteahhitA.id).maybeSingle();
  check("admin profili GOREBILMELI", adminProfil?.kullanici_id === muteahhitA.id);

  // ---- 2) Referans projeler + yorumlar SELECT (defense-in-depth) ----

  const { data: anonProjeler } = await anonClient.from("muteahhit_referans_projeler").select("*").eq("muteahhit_id", muteahhitA.id);
  check("anon referans projeleri GOREMEMELI", (anonProjeler ?? []).length === 0, `adet: ${anonProjeler?.length}`);

  const { data: anonYorumlar } = await anonClient.from("muteahhit_yorumlar").select("*").eq("muteahhit_id", muteahhitA.id);
  check("anon yorumlari GOREMEMELI", (anonYorumlar ?? []).length === 0, `adet: ${anonYorumlar?.length}`);

  // ---- 3) Yorum yazma yetkisi (item 2 - onceki migration, regresyon kontrolu) ----

  const { data: eklenenYorum, error: kazananYorumEklemeErr } = await kazananClient.from("muteahhit_yorumlar").insert({
    muteahhit_id: muteahhitA.id, kullanici_id: sahibiKazanan.id, kullanici_adi: "Test Sahibi", puan: 5,
    yorum_metni: "Teklifi kabul edilmis sahibin test yorumu.",
  }).select("id").single();
  check("teklifi kabul_edildi olan sahibi yorum EKLEYEBILMELI", !kazananYorumEklemeErr, kazananYorumEklemeErr?.message);
  if (eklenenYorum) created.yorumIds.push(eklenenYorum.id);

  const { data: kazananYorumlar } = await kazananClient.from("muteahhit_yorumlar").select("*").eq("muteahhit_id", muteahhitA.id);
  check("bulusmus ihale sahibi yorumlari GOREBILMELI", (kazananYorumlar ?? []).length > 0, `adet: ${kazananYorumlar?.length}`);

  const { error: bulusmusYorumEklemeErr } = await bulusmusClient.from("muteahhit_yorumlar").insert({
    muteahhit_id: muteahhitA.id, kullanici_id: sahibiBulusmus.id, kullanici_adi: "Test Sahibi 3", puan: 3,
    yorum_metni: "Bu yorum RLS tarafindan reddedilmeli (teklif kabul edilmemis).",
  });
  check("teklifi kabul_edilMEmis (sadece bulusmus) sahibi yorum EKLEYEMEMELI", !!bulusmusYorumEklemeErr, bulusmusYorumEklemeErr ? "beklendigi gibi reddedildi" : "HATA: eklendi!");

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
