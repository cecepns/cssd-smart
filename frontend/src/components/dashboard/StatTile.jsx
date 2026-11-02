import { Link } from 'react-router-dom';
import { TONES } from '@/utils/constants';
import { formatNumber } from '@/utils/format';

export default function StatTile({ label, value, hint, icon: Icon, tone = 'blue', to }) {
  const style = TONES[tone];
  const body = (
    <div className={`flex h-full items-center gap-3 rounded-2xl border p-4 transition ${style.soft}`}>
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${style.solid}`}>
        <Icon size={22} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-slate-500">{label}</p>
        <p className={`text-2xl font-extrabold leading-tight ${style.text}`}>{formatNumber(value)}</p>
        {hint && <p className="truncate text-[11px] text-slate-500">{hint}</p>}
      </div>
    </div>
  );
  return to ? <Link to={to} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 rounded-2xl">{body}</Link> : body;
}
