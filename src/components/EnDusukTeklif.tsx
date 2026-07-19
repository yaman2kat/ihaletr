"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PlanTuru } from "@/lib/types";

const UST_PLAN: PlanTuru = "kurumsal";

function formatPara(tutar: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency", currency: "TRY", minimumFractionDigits: 0,
  }).format(tutar);
}

interface Props {
  mevcutTeklif: number | null;
  boyut?: "kompakt" | "buyuk";
}

export default function EnDusukTeklif({ mevcutTeklif, boyut = "kompakt" }: Props) {
  const [planTuru, setPlanTuru] = useState<PlanTuru | null | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { setPlanTuru(null); return; }
      const { data } = await supabase
        .from("kullanicilar")
        .select("plan_turu")
        .eq("id", session.user.id)
        .single();
      setPlanTuru((data?.plan_turu as PlanTuru | undefined) ?? null);
    });
  }, []);

  const erisimVar = planTuru === UST_PLAN;

  if (boyut === "buyuk") {
    return (
      <div className="bg-blue-50 rounded-lg p-4">
        <p className="text-xs text-blue-500 mb-1">Güncel En Düşük Teklif</p>
        {planTuru === undefined ? (
          <div className="h-8 w-32 bg-blue-100 rounded animate-pulse" />
        ) : erisimVar ? (
          <>
            <p className="text-2xl font-bold text-blue-700">
              {mevcutTeklif ? formatPara(mevcutTeklif) : "—"}
            </p>
            {!mevcutTeklif && (
              <p className="text-xs text-blue-400 mt-1">Henüz teklif yok</p>
            )}
          </>
        ) : (
          <Link href="/premium" className="flex items-center gap-2 group">
            <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 10-8 0v4h8z" />
            </svg>
            <span className="text-sm font-semibold text-blue-700 group-hover:underline">
              En düşük teklifi görmek için üst plana geçin
            </span>
          </Link>
        )}
      </div>
    );
  }

  return (
    <div>
      <p className="text-gray-400 text-xs mb-0.5">En Düşük Teklif</p>
      {planTuru === undefined ? (
        <div className="h-5 w-24 bg-gray-100 rounded animate-pulse" />
      ) : erisimVar ? (
        <p className="font-semibold text-blue-700">
          {mevcutTeklif ? formatPara(mevcutTeklif) : "Henüz yok"}
        </p>
      ) : (
        <Link
          href="/premium"
          className="flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-700"
        >
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 10-8 0v4h8z" />
          </svg>
          Üst plana geçin
        </Link>
      )}
    </div>
  );
}
