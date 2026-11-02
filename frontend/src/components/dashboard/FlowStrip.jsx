import { Link } from 'react-router-dom';
import { ArrowRight, ScanLine } from 'lucide-react';
import { FLOW_STAGES, TONES } from '@/utils/constants';
import { formatNumber } from '@/utils/format';

/** Teks jumlah pada tiap tahap, dihitung dari data dashboard. */
const stageCount = (no, data) => {
  const pipeline = data?.pipeline || {};
  const totals = data?.totals || {};
  if (no <= 5) return { value: pipeline[no] || 0, text: 'alat di tahap ini' };
  if (no === 6) return { value: totals.waiting_verification || 0, text: 'batch menunggu' };
  if (no === 7) return { value: totals.sterile_stock || 0, text: 'paket tersedia' };
  return null;
};

/** Alur proses CSSD 9 tahap (otomatis terhubung dan terkunci per tahap). */
export default function FlowStrip({ data }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 scrollbar-thin sm:mx-0 sm:px-0">
      <ol className="flex min-w-max items-stretch gap-1.5">
        {FLOW_STAGES.map((stage, index) => {
          const tone = TONES[stage.tone];
          const count = stageCount(stage.no, data);
          return (
            <li key={stage.no} className="flex items-center gap-1.5">
              <Link
                to={stage.to}
                className={`flex h-full w-40 flex-col rounded-2xl border p-3 transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${tone.soft}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold text-white ${tone.solid}`}>{stage.no}</span>
                  {stage.barcode && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${tone.chip}`}>
                      <ScanLine size={11} /> Barcode
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm font-bold leading-snug text-slate-900">{stage.label}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{stage.sub}</p>
                {count && (
                  <p className={`mt-auto pt-2 text-xs ${tone.text}`}>
                    <b className="text-base">{formatNumber(count.value)}</b> {count.text}
                  </p>
                )}
              </Link>
              {index < FLOW_STAGES.length - 1 && <ArrowRight size={16} className="shrink-0 text-slate-300" />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
