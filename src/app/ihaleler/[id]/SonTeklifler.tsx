import type { MockTeklif } from "@/lib/mock-data";

interface Props {
  teklifler: MockTeklif[];
}

function formatTarihSaat(tarih: string): string {
  const d = new Date(tarih);
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })
    + " " + d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

export default function SonTeklifler({ teklifler }: Props) {
  if (teklifler.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Son Teklifler
        </h2>
        <p className="text-sm text-gray-400 text-center py-4">Henüz teklif verilmedi.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Son Teklifler
        <span className="ml-auto text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
          {teklifler.length} teklif
        </span>
      </h2>

      <div className="flex flex-col divide-y divide-gray-50">
        {teklifler.map((t, i) => (
          <div key={i} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            {/* Avatar */}
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-blue-700">
                {t.kullanici_adi.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800">{t.kullanici_adi}</p>
              <p className="text-xs text-gray-400">{formatTarihSaat(t.tarih)}</p>
            </div>
            <div className="flex-shrink-0">
              <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">
                Gizli
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
