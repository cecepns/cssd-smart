import { NavLink } from 'react-router-dom';
import { BOTTOM_NAV } from '@/config/navigation';

/** Navigasi bawah mobile dengan tema Navy Blue dan Champagne Gold sesuai gambar referensi. */
export default function BottomNav() {
  return (
    <nav
      aria-label="Navigasi cepat"
      className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-sky-400/30 bg-gradient-to-r from-[#001D5A] via-[#00338E] to-[#00226B] pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden shadow-2xl"
    >
      <ul className="grid grid-cols-5 divide-x divide-white/10">
        {BOTTOM_NAV.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-bold transition-all ${
                  isActive ? 'text-[#FFD028]' : 'text-sky-100/80 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex h-7 w-11 items-center justify-center rounded-full transition-all ${
                      isActive ? 'bg-gradient-to-r from-[#FFE36E] to-[#FFD028] text-[#001D5A] shadow-sm' : ''
                    }`}
                  >
                    <item.icon size={19} />
                  </span>
                  <span className="truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
