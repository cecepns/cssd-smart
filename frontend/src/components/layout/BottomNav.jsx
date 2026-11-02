import { NavLink } from 'react-router-dom';
import { BOTTOM_NAV } from '@/config/navigation';

/** Navigasi bawah (mobile): Beranda, Riwayat, Panduan, Unduhan, Pengaturan. */
export default function BottomNav() {
  return (
    <nav
      aria-label="Navigasi cepat"
      className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {BOTTOM_NAV.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition ${
                  isActive ? 'text-brand-700' : 'text-slate-500'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`flex h-7 w-12 items-center justify-center rounded-full transition ${isActive ? 'bg-brand-100' : ''}`}>
                    <item.icon size={20} />
                  </span>
                  {item.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
