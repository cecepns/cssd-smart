import { NavLink } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

/** Tab navigasi antar halaman terkait (mis. Master Data, Stok BMHP). */
export default function SubNav({ items }) {
  const { user, isAdmin } = useAuth();
  const isUnit = user?.role === 'unit';
  const visibleItems = items.filter((item) => (!item.adminOnly || isAdmin) && (!isUnit || !item.cssdOnly));

  return (
    <nav className="no-print mb-4 flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin" aria-label="Sub menu">
      {visibleItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end
          className={({ isActive }) =>
            `inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition ${
              isActive ? 'bg-brand-700 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`
          }
        >
          {item.icon && <item.icon size={15} />}
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
