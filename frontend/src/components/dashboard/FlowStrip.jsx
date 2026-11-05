import { Link } from 'react-router-dom';
import { ArrowRight, ScanLine } from 'lucide-react';
import { FLOW_STAGES, TONES } from '@/utils/constants';
import { formatNumber } from '@/utils/format';

/** Teks jumlah pada tiap tahap, dihitung dari data dashboard. */
const stageCount = (no, data) => {
  const pipeline = data?.pipeline || {};
  const totals = data?.totals || {};
  if (no === 1) return { value: totals.received_today || pipeline[1] || 0, text: 'alat masuk hari ini' };
  if (no === 2) return { value: pipeline[2] || 0, text: 'dalam dekontaminasi' };
  if (no === 3) return { value: pipeline[4] || pipeline[3] || 0, text: 'dalam pengemasan' };
  if (no === 4) return { value: pipeline[5] || 0, text: 'dalam sterilisasi' };
  if (no === 5) return { value: totals.waiting_verification || 0, text: 'menunggu verifikasi' };
  if (no === 6) return { value: totals.sterile_stock || 0, text: 'paket steril tersedia' };
  if (no === 7) return { value: totals.distributed_today || 0, text: 'alat didistribusikan' };
  if (no === 8) return { value: totals.gauze_distributed_today || 0, text: 'kasa didistribusikan' };
  return null;
};

/** Alur proses CSSD (Live Workflow) 8 tahap terintegrasi sesuai referensi desain. */
export default function FlowStrip({ data }) {
  return (
    <div className="space-y-2.5">
      {/* Header bar Live Workflow */}
      <div className="flex items-center justify-between px-1">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#0A192F] px-4 py-1.5 text-xs font-bold text-white shadow-xs">
          <span className="h-2 w-2 rounded-full bg-[#E5C07B]" />
          <span>Alur Proses CSSD (Live Workflow)</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-600">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span>((•)) Live</span>
        </div>
      </div>

      {/* 8 Stages list */}
      <div className="-mx-4 overflow-x-auto px-4 pb-2 scrollbar-thin sm:mx-0 sm:px-0">
        <ol className="flex min-w-max items-stretch gap-1.5">
          {FLOW_STAGES.map((stage, index) => {
            const tone = TONES[stage.tone] || TONES.blue;
            const count = stageCount(stage.no, data);
            return (
              <li key={stage.no} className="flex items-center gap-1.5">
                <Link
                  to={stage.to}
                  className={`flex h-full w-40 flex-col rounded-2xl border p-3 transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${tone.soft}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold text-white shadow-xs ${tone.solid}`}>
                      {stage.no}
                    </span>
                    {stage.barcode && (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${tone.chip}`}>
                        <ScanLine size={11} /> Barcode
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm font-bold leading-snug text-slate-900">{stage.label}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{stage.sub}</p>
                  {count && (
                    <p className={`mt-auto pt-2 text-[11px] ${tone.text}`}>
                      <b className="text-sm font-extrabold">{formatNumber(count.value)}</b> {count.text}
                    </p>
                  )}
                </Link>
                {index < FLOW_STAGES.length - 1 && <ArrowRight size={16} className="shrink-0 text-slate-300" />}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
