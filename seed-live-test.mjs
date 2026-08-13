import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";

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

const EMAIL = `test-live-bildirim-${Date.now()}@example.com`;
const PASSWORD = "TestSifre123!";

const { data: user, error } = await supabase.auth.admin.createUser({
  email: EMAIL,
  password: PASSWORD,
  email_confirm: true,
});
if (error) throw error;
const userId = user.user.id;

const rows = [
  { kullanici_id: userId, tur: "yeni_teklif", baslik: "Canli test bildirimi 1", mesaj: "Ilk test mesaji.", okundu: false, link: "/panel" },
  { kullanici_id: userId, tur: "ihale_onaylandi", baslik: "Canli test bildirimi 2", mesaj: "Ikinci test mesaji.", okundu: false, link: "/panel" },
  { kullanici_id: userId, tur: "davet_odulu", baslik: "Canli test bildirimi 3", mesaj: "Ucuncu test mesaji.", okundu: true, link: "/panel" },
];
const { error: insErr } = await supabase.from("bildirimler").insert(rows);
if (insErr) throw insErr;

writeFileSync("live-test-account.json", JSON.stringify({ userId, email: EMAIL, password: PASSWORD }, null, 2));
console.log("Canli test hesabi olusturuldu:", { userId, email: EMAIL });
