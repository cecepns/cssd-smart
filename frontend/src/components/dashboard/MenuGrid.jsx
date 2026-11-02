import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, SearchX } from 'lucide-react';
import SearchInput from '@/components/ui/SearchInput';
import { MENU_CARDS } from '@/config/navigation';
import { TONES } from '@/utils/constants';
import { useAuth } from '@/context/AuthContext';

/** Menu Utama berbentuk kartu berwarna dengan pencarian menu (seperti tampilan mobile). */
export default function MenuGrid() {
  const { isAdmin } = useAuth();
  const [query, setQuery] = useState('');

  const cards = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MENU_CARDS.filter((card) => (!card.adminOnly || isAdmin) && (!q || `${card.title} ${card.desc}`.toLowerCase().includes(q)));
  }, [query, isAdmin]);

  return (
    <section aria-labelledby="menu-utama">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="menu-utama" className="text-lg font-extrabold text-slate-900">Menu Utama</h2>
        <SearchInput className="w-full sm:w-72" value={query} onChange={setQuery} placeholder="Cari menu..." />
      </div>

      {cards.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 py-10 text-sm text-slate-500">
          <SearchX size={24} className="text-slate-300" /> Menu tidak ditemukan
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => {
            const tone = TONES[card.tone];
            return (
              <Link
                key={card.title}
                to={card.to}
                className={`group flex items-center gap-3 rounded-2xl border p-3.5 transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${tone.soft}`}
              >
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${tone.solid}`}>
                  <card.icon size={22} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm font-extrabold ${tone.text}`}>{card.title}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-slate-600">{card.desc}</span>
                </span>
                <ChevronRight size={18} className={`shrink-0 transition group-hover:translate-x-0.5 ${tone.text}`} />
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
