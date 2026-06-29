import { createClient } from "@/lib/supabase/client";
import { mockMuteahhitler, mockReferansProjeler, mockMuteahhitYorumlar } from "@/lib/mock-data";
import type { MuteahhitProfil, ReferansProje, MuteahhitYorum } from "@/lib/types";

export async function getMuteahhitProfil(id: string): Promise<MuteahhitProfil | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("muteahhit_profiller")
      .select("*")
      .eq("kullanici_id", id)
      .single();
    if (!error && data) return data as MuteahhitProfil;
  } catch {
    // fallthrough to mock
  }
  return mockMuteahhitler.find((m) => m.id === id) ?? null;
}

export async function getReferansProjeler(muteahhitId: string): Promise<ReferansProje[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("muteahhit_referans_projeler")
      .select("*")
      .eq("muteahhit_id", muteahhitId)
      .order("yil", { ascending: false });
    if (!error && data && data.length > 0) return data as ReferansProje[];
  } catch {
    // fallthrough to mock
  }
  return mockReferansProjeler.filter((p) => p.muteahhit_id === muteahhitId);
}

export async function getMuteahhitYorumlar(muteahhitId: string): Promise<MuteahhitYorum[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("muteahhit_yorumlar")
      .select("*")
      .eq("muteahhit_id", muteahhitId)
      .order("created_at", { ascending: false });
    if (!error && data && data.length > 0) return data as MuteahhitYorum[];
  } catch {
    // fallthrough to mock
  }
  return mockMuteahhitYorumlar.filter((y) => y.muteahhit_id === muteahhitId);
}
