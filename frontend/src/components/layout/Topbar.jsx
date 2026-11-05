import { CalendarDays, Menu, PanelLeftClose, PanelLeftOpen, ShieldCheck, X } from 'lucide-react';
import NotificationBell from '@/components/layout/NotificationBell';
import UserMenu from '@/components/layout/UserMenu';
import useClock from '@/hooks/useClock';
import { useAuth } from '@/context/AuthContext';

export default function Topbar({ collapsed, mobileOpen, onToggleMobile, onToggleCollapse, onLogout }) {
  const clock = useClock();
  const { user } = useAuth();

  const roleLabel =
    user?.role === 'admin'
      ? 'Admin CSSD'
      : user?.role === 'unit'
      ? `Unit: ${user?.unit_name || 'Luar'}`
      : 'Petugas CSSD';

  return (
    <header className="no-print fixed inset-x-0 top-0 z-40 flex h-16 items-center gap-3 bg-[#0A192F] px-3 text-white shadow-md border-b border-[#D4AF37]/30 sm:px-5">
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

      {/* Brand Header: CSSD SMART & RSUD SERPONG UTARA */}
      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-0 leading-tight">
          <div className="flex items-center gap-2">
            <span className="truncate text-lg font-black tracking-tight sm:text-xl text-white">CSSD SMART</span>
            <span className="hidden rounded-full bg-[#E5C07B] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#0A192F] shadow-xs sm:inline-block">
              RSUD SERPONG UTARA
            </span>
          </div>
          <p className="hidden truncate text-[11px] font-medium tracking-wide text-slate-300 sm:block">
            Sterile Management System
          </p>
        </div>
      </div>

      <div className="mx-2 hidden h-8 w-px bg-white/15 xl:block" />
      <div className="hidden min-w-0 leading-tight xl:block">
        <p className="truncate text-xs font-semibold text-slate-300">Akurat | Terlacak | Terdokumentasi | Terintegrasi</p>
        <p className="truncate text-[11px] text-[#E5C07B] font-bold">RSUD Serpong Utara</p>
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {/* Badge Tulisan Admin CSSD di bagian kanan atas */}
        <div className="hidden items-center gap-1.5 rounded-full border border-[#D4AF37]/50 bg-[#D4AF37]/15 px-3 py-1 text-xs font-extrabold text-[#F3E5AB] backdrop-blur sm:flex shadow-xs">
          <ShieldCheck size={14} className="text-[#E5C07B]" />
          <span>{roleLabel}</span>
        </div>

        <div className="hidden items-center gap-2 rounded-xl bg-white/10 px-3 py-1.5 text-white shadow-xs md:flex">
          <CalendarDays size={16} className="text-[#E5C07B]" />
          <span className="text-xs font-semibold text-slate-200">{clock}</span>
        </div>

        <NotificationBell />
        <UserMenu onLogout={onLogout} />
      </div>
    </header>
  );
}
