import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, LogOut, Settings, User } from 'lucide-react';
import useClickOutside from '@/hooks/useClickOutside';
import { useAuth } from '@/context/AuthContext';
import { ROUTES } from '@/config/routes';

export default function UserMenu({ onLogout }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false), open);

  const displayLabel =
    user?.role === 'admin'
      ? 'Admin'
      : user?.role === 'unit'
      ? user?.unit_name || user?.name?.split(' ')[0] || 'Unit'
      : user?.name?.split(' ')[0] || 'Petugas';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Menu pengguna"
        className="flex h-10 items-center gap-2 rounded-full bg-white pl-1.5 pr-2.5 text-[#002266] shadow-md transition hover:bg-sky-50 sm:pr-3.5"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-[#0044AA]">
          <User size={16} />
        </span>
        <span className="hidden max-w-[130px] truncate text-sm font-bold capitalize sm:block">{displayLabel}</span>
        <ChevronDown size={15} className={`hidden text-slate-500 transition sm:block ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-60 animate-fade-in overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate text-sm font-bold text-slate-900">{user?.name}</p>
            <p className="truncate text-xs text-slate-500">@{user?.username} • {user?.role}</p>
          </div>
          <Link to={ROUTES.SETTINGS} onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
            <Settings size={16} className="text-slate-400" /> Pengaturan
          </Link>
          <button type="button" onClick={onLogout} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50">
            <LogOut size={16} /> Keluar
          </button>
        </div>
      )}
    </div>
  );
}
