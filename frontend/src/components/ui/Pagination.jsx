import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PAGE_LIMITS } from '@/utils/constants';

function buildPages(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  if (start > 2) pages.push('start-gap');
  for (let i = start; i <= end; i += 1) pages.push(i);
  if (end < totalPages - 1) pages.push('end-gap');
  pages.push(totalPages);
  return pages;
}

const baseButton =
  'inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300';

export default function Pagination({ pagination, onPageChange, onLimitChange, disabled = false }) {
  const { page, limit, total, totalPages } = pagination;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
        <span>
          Menampilkan <b className="text-slate-700">{from}-{to}</b> dari <b className="text-slate-700">{total}</b> data
        </span>
        <label className="flex items-center gap-2">
          <span>Per halaman</span>
          <select
            value={limit}
            disabled={disabled}
            onChange={(e) => onLimitChange(e.target.value)}
            className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          >
            {PAGE_LIMITS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
      </div>

      <nav className="flex items-center gap-1 overflow-x-auto" aria-label="Navigasi halaman">
        <button
          type="button"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
          className={`${baseButton} gap-1 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <ChevronLeft size={16} />
          <span className="hidden sm:inline">Previous</span>
        </button>

        {buildPages(page, totalPages).map((item) =>
          typeof item === 'string' ? (
            <span key={item} className="px-1 text-slate-400">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              disabled={disabled}
              onClick={() => onPageChange(item)}
              aria-current={item === page ? 'page' : undefined}
              className={`${baseButton} ${
                item === page
                  ? 'bg-brand-700 text-white shadow-sm'
                  : 'border border-transparent text-slate-600 hover:bg-slate-100'
              }`}
            >
              {item}
            </button>
          )
        )}

        <button
          type="button"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className={`${baseButton} gap-1 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight size={16} />
        </button>
      </nav>
    </div>
  );
}
