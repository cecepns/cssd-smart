import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, SearchX, LayoutGrid } from 'lucide-react';
import SearchInput from '@/components/ui/SearchInput';
import { MENU_CARDS } from '@/config/navigation';
import { TONES } from '@/utils/constants';
import { useAuth } from '@/context/AuthContext';

/** Menu Utama dengan pencarian real-time dan gaya kartu interaktif sesuai referensi. */
export default function MenuGrid() {
  const { user, isAdmin } = useAuth();
  const isUnit = user?.role === 'unit';
  const [query, setQuery] = useState('');

  const cards = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MENU_CARDS.filter((card) => {
      if (card.adminOnly && !isAdmin) return false;
      if (isUnit && !card.allowUnit) return false;
      return !q || `${card.title} ${card.desc}`.toLowerCase().includes(q);
    });
  }, [query, isAdmin, isUnit]);

  return (
    <section aria-labelledby="menu-utama">
      <div className="mb-3.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
            <LayoutGrid size={18} />
          </span>
          <div>
            <h2 id="menu-utama" className="text-lg font-extrabold text-slate-900">
              Menu Utama {isUnit ? `(${user?.unit_name || 'Unit Luar'})` : ''}
            </h2>
            <p className="text-xs text-slate-500">Pilih modul operasional atau transaksi yang ingin dijalankan</p>
          </div>
        </div>
        <SearchInput className="w-full sm:w-72" value={query} onChange={setQuery} placeholder="Cari menu..." />
      </div>

      {cards.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 py-10 text-sm text-slate-500">
          <SearchX size={24} className="text-slate-300" /> Menu tidak ditemukan
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
          {cards.map((card) => {
            const tone = TONES[card.tone] || TONES.blue;
            return (
              <Link
                key={card.title}
                to={card.to}
                className={`group flex items-center gap-3.5 rounded-2xl border bg-white p-3.5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${tone.soft}`}
              >
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-xs transition group-hover:scale-105 ${tone.solid}`}>
                  <card.icon size={22} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm font-extrabold text-slate-900 transition group-hover:${tone.text}`}>
                    {card.title}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-slate-500 line-clamp-2">
                    {card.desc}
                  </span>
                </span>
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white shadow-xs transition group-hover:translate-x-1 ${tone.solid}`}>
                  <ChevronRight size={16} strokeWidth={2.5} />
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
