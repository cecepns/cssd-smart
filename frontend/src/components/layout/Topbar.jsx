import { CalendarDays, Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import NotificationBell from '@/components/layout/NotificationBell';
import UserMenu from '@/components/layout/UserMenu';
import useClock from '@/hooks/useClock';

export default function Topbar({ collapsed, mobileOpen, onToggleMobile, onToggleCollapse, onLogout }) {
  const clock = useClock();

  return (
    <header className="no-print fixed inset-x-0 top-0 z-40 flex h-16 items-center gap-3 bg-brand-800 px-3 text-white shadow-md sm:px-5">
      {/* Mobile / tablet: buka-tutup sidebar */}
      <button
        type="button"
        onClick={onToggleMobile}
        aria-label={mobileOpen ? 'Tutup menu' : 'Buka menu'}
        aria-expanded={mobileOpen}
        className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 transition hover:bg-white/20 lg:hidden"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
      {/* Desktop: collapse sidebar */}
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-label={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
        className="hidden h-10 w-10 items-center justify-center rounded-xl bg-white/10 transition hover:bg-white/20 lg:flex"
      >
        {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
      </button>

      <div className="flex min-w-0 items-center gap-3">
        <img src="/icon.svg" alt="" className="hidden h-9 w-9 rounded-lg sm:block" />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-lg font-extrabold tracking-tight sm:text-xl">CSSD SMART</p>
          <p className="hidden truncate text-[11px] font-medium uppercase tracking-wider text-brand-200 sm:block">RSU Serpong Utara</p>
        </div>
      </div>

      <div className="mx-2 hidden h-9 w-px bg-white/20 xl:block" />
      <div className="hidden min-w-0 leading-tight xl:block">
        <p className="truncate text-sm font-bold">Sistem Pencatatan Otomatis</p>
        <p className="truncate text-xs text-brand-100">Dari alat kotor masuk sampai menjadi alat steril</p>
        <p className="truncate text-xs font-bold text-amber-300">Barcode hanya pada 3 transaksi utama</p>
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <div className="hidden items-center gap-2 rounded-xl bg-white px-3 py-1.5 text-slate-700 shadow-sm md:flex">
          <CalendarDays size={18} className="text-brand-700" />
          <span className="text-xs font-semibold">{clock}</span>
        </div>
        <NotificationBell />
        <UserMenu onLogout={onLogout} />
      </div>
    </header>
  );
}
