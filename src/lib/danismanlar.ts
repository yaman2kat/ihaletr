import { createClient } from "./supabase/client";
import { mockDanishmanlar } from "./mock-data";
import type { Danishman } from "./types";

export async function getDanismanlarClient(): Promise<Danishman[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("danismanlar")
      .select("*")
      .order("deneyim_yili", { ascending: false });
    if (error || !data || data.length === 0) return mockDanishmanlar;
    return data as Danishman[];
  } catch {
    return mockDanishmanlar;
  }
}
