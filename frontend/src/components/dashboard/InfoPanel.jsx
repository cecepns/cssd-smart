import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';

/** Panel daftar ringkas pada dashboard. rows: [{ key, title, meta, badge }] */
export default function InfoPanel({ title, icon: Icon, tone = 'text-slate-600 bg-slate-100', rows, emptyText, to, linkLabel = 'Lihat semua' }) {
  return (
    <section className="card flex flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-sky-100 bg-gradient-to-r from-sky-50/75 to-white px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}>
            <Icon size={16} />
          </span>
          <h3 className="truncate text-sm font-extrabold text-[#002266]">{title}</h3>
        </div>
        {to && (
          <Link to={to} className="shrink-0 text-xs font-bold text-[#0055C4] hover:underline">
            {linkLabel}
          </Link>
        )}
      </header>

      {rows.length === 0 ? (
        <p className="flex flex-1 items-center justify-center gap-2 px-4 py-8 text-sm text-slate-500">
          <CheckCircle2 size={16} className="text-emerald-500" /> {emptyText}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((row) => (
            <li key={row.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{row.title}</p>
                <p className="truncate text-xs text-slate-500">{row.meta}</p>
              </div>
              {row.badge}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
